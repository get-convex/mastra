import { v, Infer } from "convex/values";
import { mutation, query } from "../_generated/server";
import { createLogger, logLevel } from "../logger";
import {
  makeConsole,
  startSteps,
  updateConfig,
  makeWorkpool,
  vStartRunContext,
  getStepStates,
} from "./lib";
import { internal } from "../_generated/api";
import { assert } from "../../utils";
import { omit } from "convex-helpers";
import { doc, literals } from "convex-helpers/validators";
import schema from "../schema";

export const create = mutation({
  args: {
    logLevel: logLevel,
    workpoolLogLevel: logLevel,
    workflow: v.object({
      fnName: v.string(),
      fnHandle: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const config = await updateConfig(ctx, {
      logLevel: args.logLevel,
      workpoolLogLevel: args.workpoolLogLevel,
    });
    const console = createLogger(config.logLevel);
    console.debug("Creating machine", args);

    // Store workflow definition
    const workflowId = await ctx.db.insert("workflows", {
      fnName: args.workflow.fnName,
      fnHandle: args.workflow.fnHandle,
      status: "created",
      maxOrder: 0,
      stepStateIds: {},
      activeBranches: [],
      suspendedBranches: [],
    });

    return workflowId;
  },
  returns: v.id("workflows"),
});

export const start = mutation({
  args: {
    workflowId: v.id("workflows"),
    triggerData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const console = await makeConsole(ctx);
    const workflow = await ctx.db.get(args.workflowId);
    assert(workflow, "Workflow not found");
    assert(
      workflow.status === "created",
      "Workflow is not created, it is " + workflow.status
    );
    console.debug("Starting workflow", { args, workflow });
    await ctx.db.patch(args.workflowId, { status: "pending" });
    const workpool = await makeWorkpool(ctx);
    const context: Infer<typeof vStartRunContext> = {
      workflowId: args.workflowId,
      triggerData: args.triggerData,
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
  returns: v.null(),
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
    const stepState = await ctx.db.get(workflow.stepStateIds[args.stepId]);
    assert(stepState, `Step state ${args.stepId} to resume not found`);
    assert(
      stepState.state.status === "suspended",
      `Step ${args.stepId} is not suspended, it is ${stepState.state.status}`
    );
    stepState.state = {
      status: "success",
      output: { ...stepState.state.suspendPayload, ...args.resumeData },
    };
    stepState.order = ++workflow.maxOrder;
    const stepStateId = await ctx.db.insert(
      "stepStates",
      omit(stepState, ["_id", "_creationTime"])
    );
    workflow.stepStateIds[args.stepId] = stepStateId;
    const targets = workflow.suspendedBranches.filter(
      (t) => t.id === args.stepId
    );
    workflow.suspendedBranches = workflow.suspendedBranches.filter(
      (t) => t.id !== args.stepId
    );
    await ctx.db.replace(args.workflowId, workflow);
    await startSteps(ctx, args.workflowId, targets, args.resumeData);
  },
  returns: v.null(),
});

export const status = query({
  args: {
    workflowId: v.id("workflows"),
  },
  handler: async (ctx, args) => {
    const console = await makeConsole(ctx);
    const workflow = await ctx.db.get(args.workflowId);
    if (!workflow) {
      console.debug("Workflow not found", args.workflowId);
      return null;
    }
    if (workflow.status === "created") {
      return { status: "created" as const };
    } else if (workflow.status === "pending") {
      return { status: "pending" as const };
    }
    const stepStates = await getStepStates(ctx, workflow);
    const { activeBranches, status } = workflow;

    return { status, stepStates, activeBranches };
  },
  returns: v.union(
    v.null(),
    v.object({
      status: v.union(literals("created", "pending", "started", "finished")),
      stepStates: v.optional(v.array(doc(schema, "stepStates"))),
      activeBranches: v.optional(
        schema.tables.workflows.validator.fields.activeBranches
      ),
    })
  ),
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const console = "THIS IS A REMINDER TO USE makeConsole";
