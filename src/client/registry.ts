"use node";
export * as libsql from "@libsql/client";
export * from "./storage.js";

import { internalActionGeneric } from "convex/server";
import type { api } from "../component/_generated/api.js";
import { UseApi } from "./types.js";
import {
  Agent,
  Step,
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
        if (op.kind === "findTransitions") {
          console.debug("Finding transitions", workflow.name);
          return findTransitions(console, workflow, op);
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
  const stepConfigs: Array<StepConfig> = [];
  const initialSteps: string[] = workflow.stepGraph.initial.map(
    (step) => step.step.id
  );

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
      // const graphEntry = workflow.stepGraph[stepId];
      // stepConfigs.push({
      //   stepId,
      //   description: step.description,
      //   payload: step.payload,
      //   retryBehavior,
      //   kind: "action",
      //   childrenIds: workflow.stepSubscriberGraph[stepId]?.initial.map((step) => step.step.id) ?? [],
      //   condition: graphEntry.

      //   inputMappings: step.inputSchema?.shape ?? {},
      //   conditions: step.when?.map((condition) => ({
      //     type: condition.type,
      //     expression: condition.expression,
      //   })),

      // });
    }
  }

  return {
    name: workflow.name,
    stepConfigs,
    initialSteps,
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
  const step = workflow.steps[op.stepId] as Step<
    string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any
  >;
  const stepStatus = op.stepsStatus[op.stepId];
  if (stepStatus.status !== "running") {
    return {
      status: "failed",
      error: `Step ${op.stepId} isn't running, it's ${stepStatus.status}`,
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const steps: Record<string, StepResult<any>> = {};
  for (const [stepId, stepStatus] of Object.entries(op.stepsStatus)) {
    if (stepStatus.status === "running") {
      steps[stepId] = { status: "waiting" };
    } else {
      steps[stepId] = stepStatus;
    }
  }
  // TODO: resolve variables
  const resolvedData = {};
  let inputData = {
    ...resolvedData,
    ...stepStatus.resumeData,
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
    const output = await step.execute({
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
