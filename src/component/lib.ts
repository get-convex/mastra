import {
  DEFAULT_RETRY_BEHAVIOR,
  resultValidator,
  WorkId,
  workIdValidator,
  Workpool,
} from "@convex-dev/workpool";
import { FunctionHandle } from "convex/server";
import { Infer, v } from "convex/values";
import { components, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  MutationCtx,
  QueryCtx,
} from "./_generated/server";
import { createLogger, DEFAULT_LOG_LEVEL, logLevel, LogLevel } from "./logger";
import {
  ActionArgs,
  StepStatus,
  Target,
  vTarget,
  vWorkflowConfig,
  WorkflowConfig,
} from "./types";
import { StepResult } from "@mastra/core";
import { assert } from "../utils";
import { validate } from "convex-helpers/validators";

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
    return config;
  },
  returns: vWorkflowConfig,
});

export const vStartRunContext = v.object({
  workflowId: v.id("workflows"),
  triggerData: v.optional(v.any()),
});

export const startRun = internalMutation({
  args: {
    workId: workIdValidator,
    result: resultValidator,
    context: vStartRunContext,
  },
  handler: async (ctx, args) => {
    const workflowId = args.context.workflowId;
    const console = await makeConsole(ctx);
    if (args.result.kind !== "success") {
      // update workflow state to failed
      console.error("Workflow failed to get the configuration", args.result);
      await ctx.db.patch(workflowId, { status: "finished" });
      return;
    }
    const config = args.result.returnValue;
    if (!validate(vWorkflowConfig, config)) {
      console.error("Workflow failed to get the configuration", args.result);
      await ctx.db.patch(workflowId, { status: "finished" });
      return;
    }
    const { name, stepConfigs, defaultBranches, subscriberBranches } = config;
    const workflow = await ctx.db.get(workflowId);
    assert(workflow);
    if (workflow.status !== "pending") {
      console.error("Workflow is not pending", workflow);
      return;
    }
    const workflowConfigId = await ctx.db.insert("workflowConfigs", {
      name,
      stepConfigs,
      defaultBranches,
      subscriberBranches,
      triggerData: args.context.triggerData,
    });
    const targetsToStart: Target[] = Object.entries(defaultBranches).map(
      ([branch, steps]) => ({
        id: steps[0],
        kind: "default",
        branch,
        index: 0,
      })
    );
    await ctx.db.patch(workflowId, { workflowConfigId, status: "started" });
    await startSteps(ctx, workflowId, targetsToStart, undefined);
  },
});

// Assumes that you've vetted that these targets are ready to start
// based on subscriptions and suspension status.
export async function startSteps(
  ctx: MutationCtx,
  workflowId: Id<"workflows">,
  targetsToStart: Target[],
  resumeData: Record<string, unknown> | undefined
) {
  const workflow = await ctx.db.get(workflowId);
  assert(workflow);
  assert(
    workflow.status === "started",
    `Workflow ${workflowId} must be started, is: ${workflow.status}`
  );
  assert(workflow.workflowConfigId);
  const config = await ctx.db.get(workflow.workflowConfigId);
  assert(config);
  const stepStates = await getStepStates(ctx, workflow);
  for (const target of targetsToStart) {
    const stepConfig = config.stepConfigs[target.id];
    assert(stepConfig);
    const step = stepStates.find((s) => s.id === target.id);
    assert(
      !step || step.state.status !== "suspended",
      `Step ${target.id} is suspended, cannot start it`
    );
    assert(
      !workflow.activeBranches.find((b) => targetsEqual(b.target, target)),
      `Trying to start the same step in the same branch: ${JSON.stringify(target)} workflowId ${workflowId}`
    );
    const workpoolId = await enqueueStep(
      ctx,
      target,
      workflow,
      config,
      stepStates,
      resumeData
    );
    workflow.activeBranches.push({ target, workId: workpoolId });
  }
  await ctx.db.replace(workflowId, workflow);
}

function targetsEqual(a: Target, b: Target) {
  return (
    a.kind === b.kind &&
    a.branch === b.branch &&
    a.index === b.index &&
    a.id === b.id &&
    (a.kind === "subscriber" && a.event) ===
      (b.kind === "subscriber" && b.event)
  );
}

async function enqueueStep(
  ctx: MutationCtx,
  target: Target,
  workflow: Doc<"workflows">,
  config: Doc<"workflowConfigs">,
  stepStates: Doc<"stepStates">[],
  resumeData?: Record<string, unknown>
): Promise<WorkId> {
  const console = await makeConsole(ctx);
  const workpool = await makeWorkpool(ctx);
  const fn = workflow.fnHandle as FunctionHandle<"action", ActionArgs>;
  const stepConfig = config.stepConfigs[target.id];
  if (!stepConfig) {
    throw new Error(
      `Step config ${target.id} not found for workflow ${workflow._id}`
    );
  }
  const orderAtStart = Math.max(...stepStates.map((s) => s.order), 0);
  const context: Infer<typeof stepOnCompleteContext> = {
    workflowId: workflow._id,
    target,
    orderAtStart,
  };
  const steps = Object.fromEntries(
    stepStates.map((stepState) => [stepState.id, stepState.state] as const)
  );

  console.debug("Enqueuing step", target, orderAtStart);
  const workpoolId = await workpool.enqueueAction(
    ctx,
    fn,
    {
      op: {
        kind: "run",
        runId: workflow._id,
        resumeData,
        triggerData: config.triggerData,
        steps,
        target,
      },
      logLevel: console.logLevel,
    },
    {
      retry: stepConfig.retryBehavior,
      onComplete: internal.workflow.lib.stepOnComplete,
      context,
    }
  );
  return workpoolId;
}

const stepOnCompleteContext = v.object({
  workflowId: v.id("workflows"),
  target: vTarget,
  orderAtStart: v.number(),
});

export const stepOnComplete = internalMutation({
  args: {
    workId: workIdValidator,
    result: resultValidator,
    context: stepOnCompleteContext,
  },
  handler: async (ctx, args) => {
    const console = await makeConsole(ctx);
    const target = args.context.target;
    let state: StepStatus;
    switch (args.result.kind) {
      case "success":
        {
          const returned = args.result.returnValue as StepResult<unknown>;
          state = returned;
        }
        break;
      case "failed":
        state = { status: "failed", error: args.result.error };
        break;
      case "canceled":
        state = { status: "failed", error: "canceled" };
        break;
    }
    console.debug("Step on complete", target, state, args.context.workflowId);
    const workflow = await ctx.db.get(args.context.workflowId);
    assert(workflow);
    if (workflow.status !== "started") {
      console.error("Workflow is not running, but step completed. Discarding", {
        workflow,
        target,
      });
      return;
    }
    // TODO: if the current version of our step started at a later order,
    // don't store it? Unless that one failed and we succeeded?

    // Assign ourselves the next order number.
    // TODO: store the state IDs in order, so we don't have to fetch them all.
    workflow.maxOrder++;
    const order = workflow.maxOrder;
    const stepStateId = await ctx.db.insert("stepStates", {
      id: target.id,
      state,
      orderAtStart: args.context.orderAtStart,
      order,
      workflowId: workflow._id,
    });
    workflow.stepStateIds[target.id] = stepStateId;
    // Update order & stepStateIds
    await ctx.db.replace(workflow._id, workflow);

    const activeIndex = workflow.activeBranches.findIndex((b) =>
      targetsEqual(b.target, target)
    );
    const active = activeIndex !== -1;
    if (active) {
      workflow.activeBranches.splice(activeIndex, 1);
    } else {
      console.warn("Step completed but was not active", {
        workflow,
        target,
      });
    }
    let targets: Target[] = [];
    if (state.status === "suspended") {
      if (!workflow.suspendedBranches.find((b) => targetsEqual(b, target))) {
        workflow.suspendedBranches.push(target);
      }
    } else if (active && state.status === "success") {
      // we should pursue potential next steps
      const stepStates = await getStepStates(ctx, workflow);
      targets = await findNextTargets(ctx, target, stepStates, workflow._id);
    }
    // Update the workflow with the new step states
    await ctx.db.replace(args.context.workflowId, workflow);
    if (targets.length) {
      await startSteps(ctx, args.context.workflowId, targets, undefined);
    } else if (active) {
      await checkForDone(ctx, args.context.workflowId);
    }
  },
});

export async function getStepStates(
  ctx: QueryCtx,
  workflow: Doc<"workflows">
): Promise<Doc<"stepStates">[]> {
  return Promise.all(
    Object.values(workflow.stepStateIds).map(async (id) => {
      const stepState = await ctx.db.get(id);
      assert(stepState);
      return stepState;
    })
  );
}

async function findNextTargets(
  ctx: MutationCtx,
  target: Target,
  stepStates: Doc<"stepStates">[],
  workflowId: Id<"workflows">
): Promise<Target[]> {
  const targets: Target[] = [];
  const workflow = await ctx.db.get(workflowId);
  assert(workflow);
  assert(workflow.workflowConfigId);
  const config = await ctx.db.get(workflow.workflowConfigId);
  assert(config);
  const stepConfig = config.stepConfigs[target.id];
  assert(stepConfig);

  // Find the next step in our branch
  const ourBranch = (
    target.kind === "subscriber"
      ? config.subscriberBranches[target.event]
      : config.defaultBranches
  )[target.branch];
  if (target.index < ourBranch.length - 1) {
    const nextTargetId = ourBranch[target.index + 1];
    const nextTargetState = stepStates.find((s) => s.id === nextTargetId);
    if (nextTargetState?.state.status !== "suspended") {
      // If it's not suspended, we can re-evaluate it.
      targets.push({
        ...target,
        id: nextTargetId,
        index: target.index + 1,
      });
    }
  }
  // TODO: Find steps in other branches that we can benefit
  // Find new subscriptions to kick off
  for (const [event, branches] of Object.entries(config.subscriberBranches)) {
    const dependencies = event.split("&&");
    if (!dependencies.includes(target.id)) {
      continue;
    }
    const valid = dependencies.every((dependency) => {
      if (dependency === target.id) return true;
      const stepState = stepStates.find((s) => s.id === dependency);
      assert(stepState);
      return stepState.state.status === "success";
    });
    if (valid) {
      for (const [branch, steps] of Object.entries(branches)) {
        targets.push({
          kind: "subscriber",
          event,
          id: steps[0],
          branch,
          index: 0,
        });
      }
    }
  }
  return targets;
}

async function checkForDone(ctx: MutationCtx, workflowId: Id<"workflows">) {
  const workflow = await ctx.db.get(workflowId);
  assert(workflow);
  assert(workflow.status === "started");
  if (
    workflow.suspendedBranches.length === 0 &&
    workflow.activeBranches.length === 0
  ) {
    console.debug("Workflow is done, setting to complete", workflowId);
    await ctx.db.patch(workflowId, {
      status: "finished",
    });
  }
}

export async function makeWorkpool(ctx: QueryCtx) {
  const config = await ctx.db.query("config").first();
  const logLevel = config?.config.workpoolLogLevel;
  return new Workpool(components.workpool, {
    maxParallelism: config?.config.maxParallelism ?? DEFAULT_MAX_PARALLELISM,
    logLevel,
    defaultRetryBehavior: DEFAULT_RETRY_BEHAVIOR,
  });
}

export async function updateConfig(
  ctx: MutationCtx,
  logLevels: {
    logLevel: LogLevel;
    workpoolLogLevel: LogLevel;
  }
): Promise<Doc<"config">["config"]> {
  let config = await ctx.db.query("config").first();
  if (!config) {
    const configId = await ctx.db.insert("config", {
      config: {
        ...logLevels,
        maxParallelism: DEFAULT_MAX_PARALLELISM,
      },
    });
    config = (await ctx.db.get(configId))!;
  } else {
    for (const [key, level] of Object.entries(logLevels)) {
      if (config.config[key as keyof typeof config.config] !== level) {
        await ctx.db.patch(config._id, {
          config: {
            ...config.config,
            [key]: level,
          },
        });
      }
    }
  }
  return config.config;
}

export async function makeConsole(ctx: QueryCtx) {
  const config = await ctx.db.query("config").first();
  return createLogger(config?.config.logLevel ?? DEFAULT_LOG_LEVEL);
}
