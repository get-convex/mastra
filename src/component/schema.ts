import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import storageTables from "./storage/tables.js";

export default defineSchema({
  ...storageTables,
  machines: defineTable({}),
});
