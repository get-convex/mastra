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
import { createLogger, logLevel } from "./logger";
export const create = mutation({
  args: {
    name: v.string(),
    logLevel,
    fnName: v.string(),
    // step config
  },
  handler: async (ctx, args) => {
    const console = createLogger(args.logLevel);
    console.debug("Creating machine", args);
    const machineId = await ctx.db.insert("machines", {
      name: args.name,
      fnName: args.fnName,
    });
    return machineId;
  },
});

export const run = mutation({
  args: {
    machineId: v.id("machines"),
    input: v.any(),
    logLevel,
  },
  handler: async (ctx, args) => {
    const console = createLogger(args.logLevel);
    const machine = await ctx.db.get(args.machineId);
    if (!machine) {
      throw new Error("Machine not found");
    }
    console.debug("Running machine", machine);
  },
});

export const status = query({
  args: {
    machineId: v.id("machines"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.machineId);
  },
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const console = "THIS IS A REMINDER TO USE createLogger";
