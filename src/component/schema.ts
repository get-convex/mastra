import { defineSchema, defineTable } from "convex/server";
import storageTables from "./storage/tables.js";

export default defineSchema({
  ...storageTables,
  machines: defineTable({}),
});
