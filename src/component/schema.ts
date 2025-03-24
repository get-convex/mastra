import { defineSchema, defineTable } from "convex/server";
import storageTables from "./storage/tables.js";
import { v } from "convex/values";
import { logLevel } from "./logger.js";
import vectorTables from "./vector/tables.js";
import {
  stepConfig,
  stepStatus,
  vStepId,
  vNamedBranches,
  vTarget,
} from "./workflow/types.js";
import { workIdValidator } from "@convex-dev/workpool";

export default defineSchema({
  config: defineTable({
    config: v.object({
      logLevel: logLevel,
      maxParallelism: v.number(),
    }),
  }),
  ...storageTables,
  ...vectorTables,
  workflows: defineTable({
    fnName: v.string(),
    fnHandle: v.string(),
    workflowConfigId: v.optional(v.id("workflowConfigs")),
    // Denormalized list of the latest version of each step.
    // TODO: use distinct on "id" after eq on workflowId, descending order
    stepStateIds: v.array(v.id("stepStates")),
    activeBranches: v.array(
      v.object({
        target: vTarget,
        workId: workIdValidator,
      })
    ),
    suspendedBranches: v.array(vTarget),
    status: v.union(
      v.literal("created"),
      v.literal("pending"),
      v.literal("started"),
      v.literal("finished")
    ),
  }),
  workflowConfigs: defineTable({
    name: v.string(),
    triggerData: v.optional(v.record(v.string(), v.any())),
    stepConfigs: v.record(vStepId, stepConfig),
    defaultBranches: vNamedBranches,
    subscriberBranches: v.record(v.string(), vNamedBranches),
  }),

  // One per step execution, updated during workflow execution.
  stepStates: defineTable({
    workflowId: v.id("workflows"),
    id: vStepId,
    state: stepStatus,
    // Each state stored for a given workflowId is given the next number.
    order: v.number(),
    // The sequence number when it started.
    orderAtStart: v.number(),
  }).index("workflowId_id_order", ["workflowId", "id", "order"]),
});
