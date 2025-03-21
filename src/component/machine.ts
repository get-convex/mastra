import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const machineId = await ctx.db.insert("machines", {
      name: args.name,
    });
    return machineId;
  },
});

export const run = mutation({
  args: {
    machineId: v.id("machines"),
    input: v.object({}),
  },
  handler: async (ctx, args) => {
    throw new Error("Not implemented");
  },
});
