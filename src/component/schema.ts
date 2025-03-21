import { defineSchema, defineTable } from "convex/server";
import storageTables from "./storage/tables.js";
import { v } from "convex/values";
import { logLevel } from "./logger.js";

export default defineSchema({
  config: defineTable({
    config: v.object({
      logLevel: logLevel,
    }),
  }),
  ...storageTables,
  machines: defineTable({
    name: v.string(),
    fnName: v.string(),
    // step config
    // retry config (per step)
  }),
});
