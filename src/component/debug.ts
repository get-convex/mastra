import { v, VString } from "convex/values";
import {
  ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";

import { logLevel } from "./logger.js";
import { internal } from "./_generated/api";
import { TableNames } from "./_generated/dataModel";
import { mapSerializedToMastra, TABLE_WORKFLOW_SNAPSHOT } from "../mapping";

export const debugOverrideLogLevel = internalMutation({
  args: {
    logLevel,
  },
  handler: async (ctx, args) => {
    const frozen = await ctx.db.query("config").first();
    if (frozen) {
      await ctx.db.patch(frozen._id, {
        config: {
          ...frozen.config,
          logLevel: args.logLevel,
        },
      });
    } else {
      await ctx.db.insert("config", {
        config: {
          logLevel: args.logLevel,
        },
      });
    }
  },
  returns: v.null(),
});

export const deleteAll = internalAction({
  args: {},
  handler: async (ctx) => {
    await Promise.all([deleteTable(ctx, "config")]);
  },
  returns: v.null(),
});

async function deleteTable(ctx: ActionCtx, table: TableNames) {
  let cursor: string | null = null;
  let isDone = false;
  while (!isDone) {
    ({ isDone, cursor } = await ctx.runMutation(internal.debug.deletePage, {
      table,
      cursor,
    }));
  }
}

export const deletePage = internalMutation({
  args: {
    table: v.string() as VString<TableNames>,
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db.query(args.table).paginate({
      cursor: args.cursor ?? null,
      numItems: 1000,
    });
    await Promise.all(results.page.map((result) => ctx.db.delete(result._id)));
    return {
      isDone: results.isDone,
      cursor: results.continueCursor,
    };
  },
  returns: v.object({
    isDone: v.boolean(),
    cursor: v.string(),
  }),
});

export const getLatestWorkflowStatus = internalQuery({
  args: {},
  handler: async (ctx): Promise<unknown> => {
    const latest = await ctx.db.query("snapshots").order("desc").first();
    if (!latest) {
      return;
    }
    const workflow = mapSerializedToMastra(TABLE_WORKFLOW_SNAPSHOT, latest);
    return workflow.snapshot;
  },
  returns: v.any(),
});
