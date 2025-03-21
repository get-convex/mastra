import { internalMutation } from "./_generated/server";

import { logLevel } from "./logger.js";

export const debugOverrideLogLevel = internalMutation({
  args: {
    logLevel,
  },
  handler: async (ctx, args) => {
    const frozen = await ctx.db.query("config").first();
    if (frozen) {
      await ctx.db.patch(frozen._id, {
        config: {
          logLevel: args.logLevel,
        },
      });
    } else {
      throw Error("No existing config to patch.");
    }
  },
});
