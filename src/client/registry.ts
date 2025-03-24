"use node";
export * as libsql from "@libsql/client";
export * from "./storage.js";

import { internalActionGeneric } from "convex/server";
import type { api } from "../component/_generated/api.js";
import { UseApi } from "./types.js";
import {
  Agent,
  Step,
  StepGraph,
  StepResult,
  Workflow,
  WorkflowContext,
} from "@mastra/core";
import { createLogger, Logger } from "../component/logger.js";
import { ConvexVector } from "./vector.js";
import { ConvexStorage } from "./storage.js";
import {
  StepConfig,
  ActionArgs,
  actionArgs,
  Transitions,
  WorkflowConfig,
  NamedBranches,
} from "../component/workflow/types.js";

export const DEFAULT_RETRY_BEHAVIOR = {
  maxAttempts: 5,
  initialBackoffMs: 1000,
  base: 2,
};

export class WorkflowRegistry {
  defaultAgents: Agent[];
  constructor(
    public component: UseApi<typeof api>,
    public options?: {
      /**
       * Agents that should use Convex for Storage and Vector
       */
      agents?: Agent[];
    }
  ) {
    this.defaultAgents = options?.agents || [];
  }

  define(
    workflow: Workflow,
    options?: {
      /** Specify agents that should use Convex for Storage and Vector */
      agents?: Agent[];
    }
  ) {
    const agents = new Set([
      ...this.defaultAgents,
      ...(options?.agents ??
        Object.values(
          Object.values(workflow.steps)
            .find((step) => step.mastra?.getAgents())
            ?.mastra?.getAgents() ?? {}
        )),
    ]);

    const action = internalActionGeneric({
      args: actionArgs,
      handler: async (ctx, args) => {
        const console = createLogger(args.logLevel);
        const op = args.op;
        if (op.kind === "getConfig") {
          console.debug("Getting config", workflow.name);
          return encodeWorkflow(workflow);
        }
        for (const agent of agents) {
          const memory = agent.getMemory();
          if (memory?.vector instanceof ConvexVector) {
            memory.vector.ctx = ctx;
          }
          if (memory?.storage instanceof ConvexStorage) {
            memory.storage.ctx = ctx;
          }
        }

        if (op.kind === "run") {
          return await runStep(console, workflow, op);
        }
      },
    });
    return action;
  }
}

function encodeWorkflow(workflow: Workflow): WorkflowConfig {
  const stepConfigs: Record<string, StepConfig> = {};

  for (const [stepId, step] of Object.entries(workflow.steps)) {
    if (step instanceof Step) {
      const retryBehavior = step.retryConfig
        ? DEFAULT_RETRY_BEHAVIOR
        : undefined;
      if (retryBehavior) {
        if (step.retryConfig?.attempts) {
          retryBehavior.maxAttempts = step.retryConfig.attempts;
        }
        if (step.retryConfig?.delay) {
          retryBehavior.initialBackoffMs = step.retryConfig.delay;
        }
      }
      stepConfigs[stepId] = {
        id: stepId,
        description: step.description,
        retryBehavior,
        kind: "action",
      };
    }
  }
  function sequencesFromGraph(graph: StepGraph): NamedBranches {
    const sequences: NamedBranches = {};
    for (const node of graph.initial) {
      const stepId = node.step.id;
      const children = graph[stepId] ?? [];
      sequences[stepId] = [stepId, ...children.map((n) => n.step.id)];
    }
    return sequences;
  }
  const defaultBranches = sequencesFromGraph(workflow.stepGraph);
  const subscriberBranches: Record<string, NamedBranches> = {};
  for (const [event, graph] of Object.entries(workflow.stepSubscriberGraph)) {
    subscriberBranches[event] = sequencesFromGraph(graph);
  }

  return {
    name: workflow.name,
    stepConfigs,
    defaultBranches,
    subscriberBranches,
  };
}

async function runStep(
  console: Logger,
  workflow: Workflow,
  op: ActionArgs["op"] & { kind: "run" }
): Promise<StepResult<unknown>> {
  let triggerData = op.triggerData;
  if (workflow.triggerSchema) {
    const validated = workflow.triggerSchema.safeParse(op.triggerData);
    if (!validated.success) {
      return { status: "failed", error: validated.error.message };
    }
    triggerData = validated.data;
  }
  const step = workflow.steps[op.target.id] as Step<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps: Record<string, StepResult<any>> = op.steps;
  const node = (
    op.target.kind === "default"
      ? workflow.stepGraph
      : workflow.stepSubscriberGraph[op.target.event]
  )[op.target.branch][op.target.index];
  if (node.step.id !== op.target.id) {
    return {
      status: "failed",
      error:
        `The step ${op.target.id} is not part of the workflow ${workflow.name} ` +
        `in ${op.target.kind} branch ${op.target.branch} at index${op.target.index}. ` +
        `Did you edit the workflow?`,
    };
  }
  const config = node.config;
  // TODO: handle conditionals
  const when = config.when;
  // TODO: resolve variables
  const requiredData = config.data;
  const resolvedData = { ...config.data };
  let inputData = {
    ...resolvedData,
    ...op.resumeData,
    ...(step.payload ?? {}), // Also done by handler internally..
  };
  if (step.inputSchema) {
    const validated = step.inputSchema.safeParse(inputData);
    if (!validated.success) {
      return { status: "failed", error: validated.error.message };
    }
    inputData = validated.data;
  }
  const context: WorkflowContext = {
    steps,
    triggerData,
    inputData,
    attempts: {}, // we handle retries ourselves
    getStepResult: (idOrStep: string | Step) => {
      const stepId = typeof idOrStep === "string" ? idOrStep : idOrStep.id;
      if (stepId === "trigger") {
        return triggerData;
      }
      const stepResult = steps[stepId];
      if (stepResult.status === "success") {
        return stepResult.output;
      }
      return undefined;
    },
  };

  let suspendPayload: unknown;
  let suspended = false;

  try {
    // difference from step.execute is tracing and payload afaict
    const output = await config.handler({
      runId: op.runId,
      context,
      suspend: async (payload: unknown) => {
        console.debug(`Suspending ${step.id} run ${op.runId}`, payload);
        suspendPayload = payload;
        suspended = true;
      },
    });
    if (output && step.outputSchema) {
      const validated = step.outputSchema.safeParse(output);
      if (validated.success) {
        return { status: "success", output: validated.data };
      } else {
        return { status: "failed", error: validated.error.message };
      }
    }
    if (suspended) {
      return { status: "suspended", suspendPayload };
    }
    return { status: "success", output };
  } catch (e) {
    console.debug(`Step ${step.id} failed in run ${op.runId}`, e);
    // If it fails, the workpool will handle retries and final failure
    throw e;
  }
}

function findTransitions(
  console: Logger,
  workflow: Workflow,
  op: ActionArgs["op"] & { kind: "findTransitions" }
): Transitions[] {
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const console = "THIS IS A REMINDER TO USE createLogger";
