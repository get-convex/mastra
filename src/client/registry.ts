export * as libsql from "@libsql/client";
export * from "./storage.js";

import { internalActionGeneric } from "convex/server";
import type { api } from "../component/_generated/api.js";
import { UseApi } from "./types.js";
import {
  Agent,
  getStepResult,
  Step,
  StepGraph,
  StepNode,
  StepResult,
  VariableReference,
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
  WorkflowConfig,
  NamedBranches,
  Target,
} from "../component/workflow/types.js";
import { assert } from "../utils.js";

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
  const steps = op.steps as Record<string, StepResult<any>>;
  let node: StepNode;
  try {
    node = lookupNode(workflow, op.target);
  } catch (e) {
    return {
      status: "failed",
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
  const config = node.config;
  // TODO: handle conditionals
  const when = config.when;
  const resolvedData = inputFromVariables({
    variables: config.data,
    triggerData,
    steps,
  });
  let inputData = {
    // resumedEvent: ..?
    ...resolvedData,
    ...op.resumeData,
    ...(step.payload ?? {}), // Also done by handler internally..
  };
  if (step.inputSchema) {
    const validated = step.inputSchema.safeParse(inputData);
    if (!validated.success) {
      console.warn(
        `Input data for step ${step.id} failed validation: ${JSON.stringify(
          inputData
        )}\n${validated.error.message}`
      );
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
      if (!stepResult) {
        return undefined;
      }
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
      // threadId: op.threadId, ?
      // resourceId: op.resourceId, ?
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

// Resolves the .step(foo, {variables: ...}) variables from steps data.
// Note: This function mostly cribbed from `@mastra/core` package. ISC /EL2 licensed.
// If it were factored out there I'd use it directly, but it's a private function atm.
function inputFromVariables(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables: Record<string, VariableReference<any, any>>;
  triggerData: unknown;
  steps: Record<string, StepResult<unknown>>;
}): Record<string, unknown> {
  const data = Object.fromEntries(
    Object.entries(args.variables).map(([key, variable]) => {
      const sourceData =
        variable.step === "trigger"
          ? args.triggerData
          : getStepResult(args.steps[variable.step.id]);

      if (!sourceData && variable.step !== "trigger") {
        return [key, undefined];
      }

      // If path is empty or '.', return the entire source data
      const value =
        !variable.path || variable.path === "."
          ? sourceData
          : getValueFromPath(sourceData, variable.path);

      return [key, value];
    })
  );

  return data;
}

// Looks up things by:
// - dot notation a.b.c
// - bracket notation a[b][c]
// - single bracket notation a[b]
// - single quote notation a['b']
// - double quote notation a["b"]
// - array notation a[1]
// - mixed notations a.b['c']
// It fails on: escaped and mixed quotes like a.b["c'"] or a.b['c\'c']
// Note: This function mostly cribbed from `raddash` package. MIT licensed.
function getValueFromPath(value: unknown, path: string) {
  const segments = path.split(/[.[\]]/g);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = value;
  for (let key of segments) {
    if (current === null || current === undefined) return undefined;
    if (key.startsWith("'") || key.startsWith('"')) {
      key = key.slice(1);
    }
    if (key.endsWith("'") || key.endsWith('"')) {
      key = key.slice(0, -1);
    }
    if (key.trim() === "") continue;
    if (typeof current !== "object" || current === null) return undefined;
    current = current[key];
  }
  return current;
}

function lookupNode(workflow: Workflow, target: Target): StepNode {
  const source =
    target.kind === "default"
      ? workflow.stepGraph
      : workflow.stepSubscriberGraph[target.event];
  let node: StepNode | undefined;
  if (target.index === 0) {
    node = source.initial.find((n) => n.step.id === target.id);
  } else {
    node = source[target.branch][target.index - 1];
  }
  assert(
    node,
    `The step ${target.id} is not part of the workflow ${workflow.name} ` +
      `in ${target.kind} branch ${target.branch} at index ${target.index}. ` +
      `Did you edit the workflow?`
  );
  assert(
    node.step.id === target.id,
    `The step ${target.id} isn't where it's supposed to be in the workflow "${workflow.name}" ` +
      `in ${target.kind} branch ${target.branch} at index ${target.index}. ` +
      `Instead, that location has the step ${node.step.id}.` +
      `Did you edit the workflow?`
  );
  return node;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const console = "THIS IS A REMINDER TO USE createLogger";
