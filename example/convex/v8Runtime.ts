import { action, mutation, query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { WorkflowRunner } from "@convex-dev/mastra";
import { v } from "convex/values";

const runner = new WorkflowRunner(components.mastra);

export const startWorkflow = action({
  args: {},
  handler: async (ctx, args) => {
    const { runId, startAsync } = await runner.create(
      ctx,
      internal.nodeRuntime.workflowAction
    );

    await startAsync({
      triggerData: {
        name: "John Doe",
        nested: {
          text: "Nested text",
        },
      },
    });
    return runner.waitForResult(ctx, runId);
  },
});

export const getStatus = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    return runner.getStatus(ctx, args.runId);
  },
});
