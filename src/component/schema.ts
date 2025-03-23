import { defineSchema, defineTable } from "convex/server";
import storageTables from "./storage/tables.js";
import { v } from "convex/values";
import { logLevel } from "./logger.js";
import vectorTables from "./vector/tables.js";
import { stepConfig, stepStatus, vStepId } from "./workflow/types.js";

const vWorkflowConfiguredState = {
  name: v.string(),
  triggerData: v.optional(v.record(v.string(), v.any())),
  stepConfigs: v.array(stepConfig),
  stepStateIds: v.array(v.id("stepStates")),
};

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
    state: v.union(
      v.object({
        status: v.literal("created"),
      }),
      v.object({
        status: v.literal("pending"),
      }),
      v.object({
        status: v.literal("running"),
        ...vWorkflowConfiguredState,
      }),
      v.object({
        status: v.literal("suspended"),
        ...vWorkflowConfiguredState,
      }),
      v.object({
        status: v.literal("completed"),
        ...vWorkflowConfiguredState,
      }),
      v.object({
        status: v.literal("failed"),
        ...vWorkflowConfiguredState,
      })
    ),
  }),

  // One per step execution, updated during workflow execution.
  stepStates: defineTable({
    workflowId: v.id("workflows"),
    id: vStepId,
    state: stepStatus,
    // Each time we loop back to a step, we make a new state.
    iteration: v.number(),
    // So we can time travel to see what this was based on.
    inputStateIds: v.array(v.id("stepStates")),
  }).index("workflowId_id_iteration", ["workflowId", "id", "iteration"]),
});
