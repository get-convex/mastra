import { defineTable } from "convex/server";
import { v } from "convex/values";
import { vAssistantContent, vToolContent, vUserContent } from "../../ai/types";

const storageSchema = {
  // messages.ts
  messages: defineTable({
    id: v.string(), // TODO: can we juse the _id?
    threadId: v.string(), // TODO: can we use v.id("threads")?
    threadOrder: v.number(),
    content: v.union(vUserContent, vAssistantContent, vToolContent),
    role: v.union(
      v.literal("system"),
      v.literal("user"),
      v.literal("assistant"),
      v.literal("tool")
    ),
    type: v.union(
      v.literal("text"),
      v.literal("tool-call"),
      v.literal("tool-result")
    ),
    createdAt: v.number(),
  })
    .index("id", ["id"])
    .index("threadId", ["threadId", "threadOrder"]),
  threads: defineTable({
    id: v.string(), // TODO: can we juse the _id?
    resourceId: v.string(),
    title: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("id", ["id"])
    .index("resourceId", ["resourceId"]),

  // index.ts
  snapshots: defineTable({
    workflowName: v.string(),
    runId: v.string(),
    snapshot: v.string(), // JSON for now, later:
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("runId", ["runId", "workflowName"]),
  evals: defineTable({
    input: v.string(),
    output: v.string(),
    result: v.any(),
    agentName: v.string(),
    metricName: v.string(),
    instructions: v.string(),
    testInfo: v.optional(v.any()),
    globalRunId: v.string(),
    runId: v.string(),
    createdAt: v.number(),
  }).index("agentName", ["agentName", "testInfo.testPath"]),
  traces: defineTable({
    id: v.string(), // TODO: can we juse the _id?
    parentSpanId: v.optional(v.union(v.string(), v.null())),
    name: v.string(),
    traceId: v.string(),
    scope: v.string(),
    kind: v.union(v.number(), v.int64()),
    attributes: v.optional(v.any()),
    status: v.optional(v.any()),
    events: v.optional(v.any()),
    links: v.optional(v.any()),
    other: v.optional(v.string()),
    startTime: v.int64(),
    endTime: v.int64(),
    createdAt: v.number(),
  })
    .index("scope", ["scope"])
    .index("name", ["name"]),
};

export type TableNames = keyof typeof storageSchema;

export default storageSchema;
