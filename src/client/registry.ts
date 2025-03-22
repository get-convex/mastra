"use node";
export * as libsql from "@libsql/client";
export * from "./storage.js";

import { internalActionGeneric } from "convex/server";
import { ObjectType, v } from "convex/values";
import type { api } from "../component/_generated/api.js";
import { UseApi } from "./types.js";
import { Agent, MastraStorage, StepAction, Workflow } from "@mastra/core";
import { InMemoryStorage } from "./in-memory.js";
import {
  createLogger,
  DEFAULT_LOG_LEVEL,
  LogLevel,
} from "../component/logger.js";
import { ConvexVector } from "./vector.js";
import { ConvexStorage } from "./storage.js";

const actionArgs = {
  op: v.union(
    v.object({
      kind: v.literal("create"),
      fnHandle: v.string(),
      fnName: v.string(),
    }),
    v.object({
      kind: v.literal("run"),
      runId: v.string(),
      stepId: v.string(),
      triggerData: v.any(),
      resumeData: v.any(),
    })
  ),
};
export type ActionArgs = ObjectType<typeof actionArgs>;

export class WorkflowRegistry {
  storage: MastraStorage;
  logLevel: LogLevel;
  constructor(
    public component: UseApi<typeof api>,
    public options?: {
      logLevel?: LogLevel;
    }
  ) {
    this.storage = new InMemoryStorage();
    this.logLevel = options?.logLevel ?? DEFAULT_LOG_LEVEL;
    // TODO: take in default retry config
  }
  define(
    workflow: Workflow,
    options?: {
      /** Specify agents that should use Convex for Storage and Vector */
      agents?: Agent[];
    }
  ) {
    const console = createLogger(this.logLevel);
    const agents =
      options?.agents ??
      Object.values(
        Object.values(workflow.steps)
          .find((step) => step.mastra?.getAgents())
          ?.mastra?.getAgents() ?? {}
      );
    const action = internalActionGeneric({
      args: actionArgs,
      handler: async (ctx, args) => {
        if (args.op.kind === "create") {
          console.debug("Creating machine from client", args.op.fnName);
          const machineId = await ctx.runMutation(
            this.component.machine.create,
            {
              name: workflow.name,
              logLevel: this.logLevel,
              fnName: args.op.fnName,
              // step config
              // retry config
            }
          );
          return machineId;
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
        if (args.op.kind === "run") {
          // TODO: validate input
          const step = workflow.steps[args.op.stepId] as StepAction<
            string,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            any
          >;
          const output = await step.execute({
            runId: args.op.runId,
            context: {
              steps: workflow.steps,
              triggerData: args.op.triggerData,
              resumeData: args.op.resumeData,
              attempts: {}, // we handle retries ourselves
              getStepResult: (stepId: string) => {
                console.debug("getStepResult", stepId);
                throw new Error("Not implemented");
              },
              // TODO: is this right?
              ...(step.payload ?? {}),
            },
            suspend: async () => {
              throw new Error("Not implemented");
            },
          });
          // TODO: validate output
          // TODO: serialize?
          return output;
        }
      },
    });
    return action;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const console = "THIS IS A REMINDER TO USE createLogger";
