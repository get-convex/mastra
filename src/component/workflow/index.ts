import { v, Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import { createLogger, logLevel } from "../logger";
import {
  makeConsole,
  startSteps,
  updateConfig,
  makeWorkpool,
  vStartRunContext,
} from "./lib";
import { internal } from "../_generated/api";
import { assert } from "../../utils";

export const create = mutation({
  args: {
    logLevel: logLevel,
    workflow: v.object({
      fnName: v.string(),
      fnHandle: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const config = await updateConfig(ctx, args.logLevel);
    const console = createLogger(config.logLevel);
    console.debug("Creating machine", args);

    // Store workflow definition
    const workflowId = await ctx.db.insert("workflows", {
      fnName: args.workflow.fnName,
      fnHandle: args.workflow.fnHandle,
      status: "created",
      stepStateIds: [],
      activeBranches: [],
      suspendedBranches: [],
    });

    return workflowId;
  },
});

export const start = mutation({
  args: {
    workflowId: v.id("workflows"),
    initialData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const console = await makeConsole(ctx);
    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow) {
      throw new Error("Workflow not found");
    }
    if (workflow.status !== "created") {
      throw new Error(
        "Workflow cannot be started, it is already " + workflow.status
      );
    }
    console.debug("Starting workflow", { args, workflow });
    await ctx.db.patch(args.workflowId, {
      status: "pending",
    });
    const workpool = await makeWorkpool(ctx);
    const context: Infer<typeof vStartRunContext> = {
      workflowId: args.workflowId,
      initialData: args.initialData,
    };
    await workpool.enqueueAction(
      ctx,
      internal.workflow.lib.configure,
      {
        workflowId: args.workflowId,
        fnHandle: workflow.fnHandle,
        logLevel: console.logLevel,
      },
      {
        retry: true,
        onComplete: internal.workflow.lib.startRun,
        context,
      }
    );
  },
});

export const resume = mutation({
  args: {
    workflowId: v.id("workflows"),
    stepId: v.string(),
    resumeData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const console = await makeConsole(ctx);
    const workflow = await ctx.db.get(args.workflowId);
    assert(workflow);
    assert(workflow.status === "started");
    assert(workflow.workflowConfigId);
    console.debug("Resuming workflow", args);
    const workflowConfig = await ctx.db.get(workflow.workflowConfigId);
    assert(workflowConfig);
    const stepConfig = workflowConfig.stepConfigs[args.stepId];
    assert(stepConfig, `Step config ${args.stepId} to resume not found`);
    const targets = workflow.suspendedBranches.filter(
      (t) => t.id === args.stepId
    );
    await startSteps(ctx, args.workflowId, targets, args.resumeData);
  },
});

export const status = query({
  args: {
    workflowId: v.id("workflows"),
  },
  handler: async (ctx, args) => {
    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow) {
      return null;
    }
    if (workflow.status === "created") {
      return { status: "created" };
    } else if (workflow.status === "pending") {
      return { status: "pending" };
    }
    const stepStates = await Promise.all(
      workflow.stepStateIds.map(async (stepStateId) => {
        const stepState = await ctx.db.get(stepStateId);
        if (!stepState) {
          return null;
        }
        const { state, id } = stepState;
        return { state, stepId: id };
      })
    );
    const { activeBranches, status } = workflow;

    return { status, stepStates, activeBranches };
  },
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const console = "THIS IS A REMINDER TO USE makeConsole";
