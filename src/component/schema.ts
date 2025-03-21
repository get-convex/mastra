import { defineSchema, defineTable } from "convex/server";
import storageTables from "./storage/tables.js";
import { v } from "convex/values";
import { logLevel } from "./logger.js";
import vectorTables from "./vector/tables.js";
export default defineSchema({
  config: defineTable({
    config: v.object({
      logLevel: logLevel,
    }),
  }),
  ...storageTables,
  ...vectorTables,
  machines: defineTable({
    name: v.string(),
    fnName: v.string(),
    // step config
    // retry config (per step)
  }),
});
