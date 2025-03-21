import { internalMutation, query, mutation } from "./_generated/server";
import { components } from "./_generated/api";
import { Mastra } from "@convex-dev/mastra";

const mastra = new Mastra(components.mastra, {
  shards: { beans: 10, users: 100 },
});
const numUsers = mastra.for("users");

export const addOne = mutation({
  args: {},
  handler: async (ctx, _args) => {
    await numUsers.inc(ctx);
  },
});

export const getCount = query({
  args: {},
  handler: async (ctx, _args) => {
    return await numUsers.count(ctx);
  },
});

export const usingClient = internalMutation({
  args: {},
  handler: async (ctx, _args) => {
    await mastra.add(ctx, "accomplishments");
    await mastra.add(ctx, "beans", 2);
    const count = await mastra.count(ctx, "beans");
    return count;
  },
});

export const usingFunctions = internalMutation({
  args: {},
  handler: async (ctx, _args) => {
    await numUsers.inc(ctx);
    await numUsers.inc(ctx);
    await numUsers.dec(ctx);
    return numUsers.count(ctx);
  },
});

export const directCall = internalMutation({
  args: {},
  handler: async (ctx, _args) => {
    await ctx.runMutation(components.mastra.lib.add, {
      name: "pennies",
      count: 250,
    });
    await ctx.runMutation(components.mastra.lib.add, {
      name: "beans",
      count: 3,
      shards: 100,
    });
    const count = await ctx.runQuery(components.mastra.lib.count, {
      name: "beans",
    });
    return count;
  },
});

// Direct re-export of component's API.
export const { add, count } = mastra.api();
