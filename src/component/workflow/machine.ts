import { v } from "convex/values";
import { mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { createLogger, LogLevel, DEFAULT_LOG_LEVEL, logLevel } from "./logger";
import { Doc } from "./_generated/dataModel";

export const create = mutation({
  args: {
    name: v.string(),
    fnName: v.string(),
    logLevel,
    // step config
  },
  handler: async (ctx, args) => {
    const config = await updateConfig(ctx, args.logLevel);
    const console = createLogger(config.logLevel);
    console.debug("Creating machine", args);
    const machineId = await ctx.db.insert("machines", {
      name: args.name,
      fnName: args.fnName,
    });
    return machineId;
  },
});

async function updateConfig(
  ctx: MutationCtx,
  logLevel: LogLevel
): Promise<Doc<"config">["config"]> {
  let config = await ctx.db.query("config").first();
  if (!config) {
    const configId = await ctx.db.insert("config", {
      config: {
        logLevel,
      },
    });
    config = (await ctx.db.get(configId))!;
  } else if (config.config.logLevel !== logLevel) {
    await ctx.db.patch(config._id, {
      config: {
        logLevel,
      },
    });
  }
  return config.config;
}

async function makeConsole(ctx: QueryCtx) {
  const config = await ctx.db.query("config").first();
  return createLogger(config?.config.logLevel ?? DEFAULT_LOG_LEVEL);
}

export const run = mutation({
  args: {
    machineId: v.id("machines"),
    input: v.any(),
  },
  handler: async (ctx, args) => {
    const console = await makeConsole(ctx);
    const machine = await ctx.db.get(args.machineId);
    if (!machine) {
      throw new Error("Machine not found");
    }
    console.debug("Running machine", { args, machine });
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
const console = "THIS IS A REMINDER TO USE makeConsole";
