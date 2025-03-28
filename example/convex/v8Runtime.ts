import { query } from "./_generated/server";
import { components } from "./_generated/api";
import { v } from "convex/values";
import {
  mapSerializedToMastra,
  TABLE_WORKFLOW_SNAPSHOT,
} from "@convex-dev/mastra/mapping";

export const getStatus = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.runQuery(
      components.mastra.storage.storage.loadSnapshot,
      {
        workflowName: "weatherToOutfitWorkflow",
        runId: args.runId,
      }
    );
    if (!doc) {
      return null;
    }
    const snapshot = mapSerializedToMastra(TABLE_WORKFLOW_SNAPSHOT, doc);
    const { childStates, activePaths, suspendedSteps } = snapshot.snapshot;
    return { childStates, activePaths, suspendedSteps };
  },
});
