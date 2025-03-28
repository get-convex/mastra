import { defineSchema } from "convex/server";
import storageTables from "./storage/tables.js";
import vectorTables from "./vector/tables.js";

export default defineSchema({
  ...storageTables,
  ...vectorTables,
});
