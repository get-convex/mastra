import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { createLogger, logLevel } from "../logger";
import { makeConsole, startSteps, updateConfig } from "./lib";

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
      state: {
        status: "created",
      },
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
    if (workflow.state.status !== "created") {
      throw new Error(
        "Workflow cannot be started, it is already " + workflow.state.status
      );
    }
    console.debug("Starting workflow", { args, workflow });
    await ctx.db.patch(args.workflowId, {
      state: {
        status: "pending",
      },
    });
    // enqueue configuring in workpool
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
    if (!workflow) {
      throw new Error("Workflow not found");
    }
    const workflowState = workflow.state;
    if (workflowState.status === "suspended") {
      await ctx.db.patch(args.workflowId, {
        state: { ...workflowState, status: "running" },
      });
    } else if (workflowState.status !== "running") {
      throw new Error("Workflow is not running or suspended");
    }
    console.debug("Resuming workflow", args);

    await startSteps(ctx, args.workflowId, [args.stepId], args.resumeData);
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
    const workflowState = workflow.state;
    if (workflowState.status === "created") {
      return {
        status: "created",
      };
    } else if (workflowState.status === "pending") {
      return {
        status: "pending",
      };
    }
    const stepStates = await Promise.all(
      workflowState.stepStateIds.map(async (stepStateId) => {
        const stepState = await ctx.db.get(stepStateId);
        if (!stepState) {
          return null;
        }
        const { state, generation, id } = stepState;
        return { state, generation, stepId: id };
      })
    );
    const { name, status } = workflowState;

    return { name, status, stepStates };
  },
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const console = "THIS IS A REMINDER TO USE makeConsole";
