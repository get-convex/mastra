import { action, mutation, query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { WorkflowRunner } from "@convex-dev/mastra";
import { v } from "convex/values";

const runner = new WorkflowRunner(components.mastra, {
  logLevel: "DEBUG",
  workpoolLogLevel: "INFO",
});

export const getStatus = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    return runner.getStatus(ctx, args.runId);
  },
});

export const createWorkflow = mutation({
  args: {},
  handler: async (ctx) => {
    const { runId, startAsync } = await runner.create(
      ctx,
      // Registered in the a "use node" file
      internal.nodeRuntime.weatherToOutfitWorkflowAction
    );
    await startAsync({
      triggerData: {
        location: "San Francisco",
      },
    });
    return runId;
  },
});

export const resumeWorkflow = mutation({
  args: {
    runId: v.string(),
    refinement: v.string(),
  },
  handler: async (ctx, args) => {
    return await runner.resumeAsync(ctx, args.runId, {
      stepId: "refineOutfit",
      context: {
        refinement: args.refinement,
      },
    });
  },
});
