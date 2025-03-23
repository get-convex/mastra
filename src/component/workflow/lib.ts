import {
  resultValidator,
  WorkId,
  workIdValidator,
  Workpool,
} from "@convex-dev/workpool";
import { FunctionHandle } from "convex/server";
import { Infer, v } from "convex/values";
import { components, internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import {
  internalAction,
  internalMutation,
  MutationCtx,
  QueryCtx,
} from "../_generated/server";
import { createLogger, DEFAULT_LOG_LEVEL, logLevel, LogLevel } from "../logger";
import { ActionArgs, stepConfig, StepStatus, WorkflowConfig } from "./types";
import { StepResult } from "@mastra/core";

export const DEFAULT_MAX_PARALLELISM = 20;

export const configure = internalAction({
  args: {
    workflowId: v.id("workflows"),
    fnHandle: v.string(),
    logLevel,
  },
  handler: async (ctx, args) => {
    const handle = args.fnHandle as FunctionHandle<
      "action",
      ActionArgs,
      WorkflowConfig
    >;
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
          generation: 0,
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
    const stepsToStart = args.initialSteps.map((s) => {
      const stepConfig = args.stepConfigs.find((c) => c.id === s);
      if (!stepConfig) {
        throw new Error(`Step config ${s} for initial step not found`);
      }
      return stepConfig;
    });

    await startSteps(ctx, args.workflowId, stepsToStart);
  },
});

export async function startSteps(
  ctx: MutationCtx,
  workflowId: Id<"workflows">,
  stepsToStart: { id: string; dependsOn?: string[] }[],
  resumeData?: Record<string, unknown>
) {
  const toStart = new Set(stepsToStart.map((s) => s.id));
  for (const step of stepsToStart) {
    // TODO: check dependencies
    // toStart.delete(step.id);
  }
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
      if (!toStart.has(stepState.id)) {
        return stepState;
      }
      if (stepState.state.status === "suspended") {
        // Don't retry a suspended step until it's resumed
        toStart.delete(stepState.id);
        return stepState;
      }
      if (stepState.state.status === "running") {
        // Don't start a step that's already running
        toStart.delete(stepState.id);
        return stepState;
      }
      const newStateId = await ctx.db.insert("stepStates", {
        ...stepState,
        state: {
          status: "running",
          workpoolId: "" as WorkId, // we'll patch this next with the workpool id
          resumeData: resumeData,
        },
        generation: stepState.generation + 1,
        inputStateIds: [], // we'll patch this next with the updated list
      });
      return (await ctx.db.get(newStateId))!;
    })
  );
  const stepStateIds = allStates.map((s) => s._id);
  workflowState.stepStateIds = stepStateIds;
  await ctx.db.patch(workflowId, { state: workflowState });
  if (toStart.size === 0) {
    return false;
  }
  for (const s of allStates) {
    if (!toStart.has(s.id)) {
      continue;
    }
    const workpoolId = await enqueueStep(ctx, s, workflow, allStates);
    if (s.state.status !== "running") {
      throw new Error("Step status should be running: " + s._id);
    }

    await ctx.db.patch(s._id, {
      inputStateIds: stepStateIds,
      state: {
        ...s.state,
        workpoolId,
      },
    });
  }
  return true;
}

async function enqueueStep(
  ctx: MutationCtx,
  step: Doc<"stepStates">,
  workflow: Doc<"workflows">,
  allStates: Doc<"stepStates">[]
): Promise<WorkId> {
  const workflowState = workflow.state;
  if (workflowState.status !== "running") {
    throw new Error("Workflow is not running");
  }
  const {
    config: { logLevel },
  } = (await ctx.db.query("config").first())!;
  const workpool = await makeWorkpool(ctx);
  const fn = workflow.fnHandle as FunctionHandle<"action", ActionArgs>;
  const stepConfig = workflowState.stepConfigs.find((s) => s.id === step.id);
  if (!stepConfig) {
    throw new Error(
      `Step config ${step.id} not found for workflow ${workflow._id}`
    );
  }
  const workpoolId = await workpool.enqueueAction(
    ctx,
    fn,
    {
      op: {
        kind: "run",
        runId: workflow._id,
        stepId: step.id,
        triggerData: workflowState.triggerData,
        stepsStatus: allStates.reduce(
          (acc, s) => {
            acc[s.id] = s.state;
            return acc;
          },
          {} as Record<string, StepStatus>
        ),
      },
      logLevel,
    },
    {
      retry: stepConfig.retryBehavior,
      onComplete: internal.workflow.lib.stepOnComplete,
      context: {
        workflowId: workflow._id,
        stepStateId: step._id,
        generation: step.generation,
      } as Infer<typeof stepOnCompleteContext>,
    }
  );
  return workpoolId;
}

const stepOnCompleteContext = v.object({
  workflowId: v.id("workflows"),
  stepStateId: v.id("stepStates"),
  generation: v.number(),
});

export const stepOnComplete = internalMutation({
  args: {
    workId: workIdValidator,
    result: resultValidator,
    context: stepOnCompleteContext,
  },
  handler: async (ctx, args) => {
    const console = await makeConsole(ctx);
    const step = await ctx.db.get(args.context.stepStateId);
    if (!step) {
      throw new Error("Step state not found");
    }
    switch (args.result.kind) {
      case "success":
        {
          const returned = args.result.returnValue as StepResult<unknown>;
          step.state = returned;
        }
        break;
      case "failed":
        step.state = { status: "failed", error: args.result.error };
        break;
      case "canceled":
        step.state = { status: "failed", error: "canceled" };
        break;
    }
    console.debug("Step on complete", step.id, step.state, step.workflowId);
    await ctx.db.patch(step._id, { state: step.state });
    const workflow = await ctx.db.get(args.context.workflowId);
    if (!workflow) {
      throw new Error("Workflow not found");
    }
    let workflowState = workflow.state;
    if (workflowState.status !== "running") {
      console.error("Workflow is not running, but step is suspended", {
        workflow,
        step,
      });
      return;
    }
    if (!workflowState.stepStateIds.includes(step._id)) {
      console.warn("Step is not the latest version in the workflow", step);
      return;
    }

    if (step.state.status === "suspended") {
      workflowState = {
        ...workflowState,
        status: "suspended",
      };
      workflow.state = workflowState;
      await ctx.db.patch(args.context.workflowId, { state: workflowState });
    } else if (step.state.status === "success") {
      // we should pursue potential next steps
      const stepConfig = workflowState.stepConfigs.find(
        (s) => s.id === step.id
      );
      if (!stepConfig) {
        throw new Error("Step config not found");
      }
      const childrenToCheck = stepConfig.children;
      if (childrenToCheck && childrenToCheck.length >= 0) {
        if (await startSteps(ctx, args.context.workflowId, childrenToCheck)) {
          return;
        }
      }
    }
    await checkForDone(ctx, args.context.workflowId);
  },
});

async function checkForDone(ctx: MutationCtx, workflowId: Id<"workflows">) {
  const workflow = await ctx.db.get(workflowId);
  if (!workflow) {
    throw new Error("Workflow not found");
  }
  if (workflow.state.status !== "running") {
    throw new Error("Workflow is not running");
  }
  const statesById = Object.fromEntries(
    await Promise.all(
      workflow.state.stepStateIds.map(async (id) => {
        const state = await ctx.db.get(id);
        if (!state) {
          throw new Error("Step state not found");
        }
        return [state.id, state.state.status] as const;
      })
    )
  );
  // If all steps are done, or waiting but not
  const allDoneOrWaiting = workflow.state.stepConfigs.every((s) =>
    ["success", "failed", "skipped", "waiting"].includes(statesById[s.id])
  );
  // If there are any successful steps, make sure no children are actionable.
  const noActionableChildren = workflow.state.stepConfigs.every(
    (s) =>
      !s.children ||
      statesById[s.id] !== "success" ||
      s.children.find((child) =>
        ["waiting", "running", "suspended"].includes(statesById[child.id])
      ) !== undefined
  );
  if (allDoneOrWaiting && noActionableChildren) {
    console.debug("Workflow is done, setting to complete", workflowId);
    await ctx.db.patch(workflowId, {
      state: {
        ...workflow.state,
        status: "completed",
      },
    });
  }
}

async function makeWorkpool(ctx: QueryCtx) {
  const config = await ctx.db.query("config").first();
  const logLevel = config?.config.logLevel ?? DEFAULT_LOG_LEVEL;
  return new Workpool(components.workpool, {
    maxParallelism: config?.config.maxParallelism ?? DEFAULT_MAX_PARALLELISM,
    logLevel: logLevel === "TRACE" ? "INFO" : logLevel,
  });
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
        maxParallelism: DEFAULT_MAX_PARALLELISM,
      },
    });
    config = (await ctx.db.get(configId))!;
  } else if (config.config.logLevel !== logLevel) {
    await ctx.db.patch(config._id, {
      config: {
        ...config.config,
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
