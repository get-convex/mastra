import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  MutationCtx,
  QueryCtx,
} from "../_generated/server";
import { createLogger, logLevel, LogLevel, DEFAULT_LOG_LEVEL } from "../logger";
import { Doc, Id } from "../_generated/dataModel";
import { stepConfig } from "./types";
import { ActionArgs } from "../../client/registry";
import { FunctionHandle } from "convex/server";
import { resultValidator, WorkId, workIdValidator } from "@convex-dev/workpool";
import { internal } from "../_generated/api";

// const workpool = new Workpool(components.)
export const configure = internalAction({
  args: {
    workflowId: v.id("workflows"),
    fnHandle: v.string(),
    logLevel,
  },
  handler: async (ctx, args) => {
    const handle = args.fnHandle as FunctionHandle<"action", ActionArgs>;
    const config = await ctx.runAction(handle, {
      op: { kind: "getConfig" },
      logLevel: DEFAULT_LOG_LEVEL,
    });
    await ctx.runMutation(internal.workflow.lib.startRun, {
      ...config,
      workflowId: args.workflowId,
    });
  },
});

export const startRun = internalMutation({
  args: {
    workflowId: v.id("workflows"),
    name: v.string(),
    stepConfigs: v.array(stepConfig),
    initialSteps: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const console = await makeConsole(ctx);
    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow) {
      console.error("Workflow not found");
      return;
    }
    if (workflow.state.status !== "pending") {
      console.error("Workflow is not pending", workflow?.state);
      return;
    }
    const stepStateIds = await Promise.all(
      args.stepConfigs.map(async (stepConfig) => {
        return await ctx.db.insert("stepStates", {
          workflowId: args.workflowId,
          id: stepConfig.id,
          state: { status: "waiting" },
          iteration: 0,
          inputStateIds: [],
        });
      })
    );
    await ctx.db.patch(args.workflowId, {
      state: {
        status: "running",
        name: args.name,
        stepConfigs: args.stepConfigs,
        stepStateIds,
      },
    });
    await startSteps(ctx, args.workflowId, args.initialSteps);
  },
});

export async function startSteps(
  ctx: MutationCtx,
  workflowId: Id<"workflows">,
  stepsToStart: string[]
) {
  const workflow = await ctx.db.get(workflowId);
  if (!workflow) {
    throw new Error("Workflow not found");
  }
  const workflowState = workflow.state;
  if (workflowState.status !== "running") {
    throw new Error("Workflow is not running");
  }
  const allStates = await Promise.all(
    workflowState.stepStateIds.map(async (id) => {
      const stepState = await ctx.db.get(id);
      if (!stepState) {
        throw new Error("Step state not found");
      }
      if (!stepsToStart.includes(stepState.id)) {
        return stepState;
      }
      if (stepState.state.status !== "waiting") {
        throw new Error(
          "Step is trying to start, but is not waiting: " + stepState.id
        );
      }
      const newStateId = await ctx.db.insert("stepStates", {
        ...stepState,
        state: {
          status: "running",
          workpoolId: "" as WorkId, // we'll patch this next with the workpool id
        },
        iteration: stepState.iteration + 1,
        inputStateIds: [], // we'll patch this next with the updated list
      });
      return (await ctx.db.get(newStateId))!;
    })
  );
  const inputStateIds = allStates.map((s) => s._id);
  for (const s of allStates) {
    if (!stepsToStart.includes(s.id)) {
      continue;
    }
    const stepConfig = workflowState.stepConfigs.find((s) => s.id === s.id);
    if (!stepConfig) {
      throw new Error(
        `Step config ${s.id} not found for workflow ${workflowId}`
      );
    }
    const workpoolId = await enqueueStep(ctx, s.id, workflowState, allStates);
    // TODO: schedule them in workpool
    if (s.state.status !== "running") {
      throw new Error("Step status should be running: " + s._id);
    }

    await ctx.db.patch(s._id, {
      inputStateIds,
      state: {
        ...s.state,
        workpoolId,
      },
    });
  }
}
export async function updateConfig(
  ctx: MutationCtx,
  logLevel: LogLevel
): Promise<Doc<"config">["config"]> {
  let config = await ctx.db.query("config").first();
  if (!config) {
    const configId = await ctx.db.insert("config", {
      config: {
        logLevel,
      },
    });
    config = (await ctx.db.get(configId))!;
  } else if (config.config.logLevel !== logLevel) {
    await ctx.db.patch(config._id, {
      config: {
        logLevel,
      },
    });
  }
  return config.config;
}

export async function makeConsole(ctx: QueryCtx) {
  const config = await ctx.db.query("config").first();
  return createLogger(config?.config.logLevel ?? DEFAULT_LOG_LEVEL);
}

export const stepOnComplete = internalMutation({
  args: {
    workId: workIdValidator,
    result: resultValidator,
    context: v.object({
      workflowId: v.id("workflows"),
      stepId: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    // TODO: update step state
    // If suspended, set workflow to suspended
    // If failed, set workflow to failed
    // Find next steps to evaluate via fnHandle
    // If no steps, set workflow to complete
    // Start next steps
  },
});

async function enqueueStep(
  ctx: MutationCtx,
  id: string,
  workflowState: Doc<"workflows">["state"] & { status: "running" },
  allStates: Doc<"stepStates">[]
): Promise<WorkId> {
  // TODO: Implement actual step execution
  // Get all data needed for step execution
  // Enqueue step in workpool
  // Return workpool id
  return "123" as WorkId;
}
