"use node";
export * as libsql from "@libsql/client";
export * from "./storage.js";

import {
  actionGeneric,
  internalActionGeneric,
  mutationGeneric,
  queryGeneric,
  RegisteredAction,
} from "convex/server";
import { v } from "convex/values";
import type { api } from "../component/_generated/api.js";
import { RunMutationCtx, RunQueryCtx, UseApi } from "./types.js";
import { MastraBase, MastraStorage, StepAction, Workflow } from "@mastra/core";
import { ConvexStorage } from "./storage.js";
import { InMemoryStorage } from "./in-memory.js";
import { createLogger, LogLevel } from "../component/logger.js";

export class WorkflowRegistry {
  storage: MastraStorage;
  logLevel: LogLevel;
  constructor(
    public component: UseApi<typeof api>,
    public options?: { logLevel?: LogLevel }
  ) {
    this.storage = new InMemoryStorage();
    this.logLevel = options?.logLevel ?? "DEBUG";
    // TODO: take in default retry config
  }
  registerWorkflow(workflow: Workflow) {
    const console = createLogger(this.logLevel);
    const action = internalActionGeneric({
      args: {
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
      },
      handler: async (ctx, args) => {
        if (args.op.kind === "create") {
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
        } else if (args.op.kind === "run") {
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
