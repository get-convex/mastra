import { defineTable } from "convex/server";
import { v } from "convex/values";

export const embeddings = {
  id: v.string(),
  vector: v.array(v.number()),
  metadata: v.record(v.string(), v.any()),
};

// Hack to get vector indexes of arbitrary* dimensions
export default {
  embeddings4096: defineTable(embeddings).vectorIndex("vector", {
    vectorField: "vector",
    dimensions: 4096,
    filterFields: ["metadata"],
  }),
  embeddings3072: defineTable(embeddings).vectorIndex("vector", {
    vectorField: "vector",
    dimensions: 3072,
    filterFields: ["metadata"],
  }),
  embeddings2048: defineTable(embeddings).vectorIndex("vector", {
    vectorField: "vector",
    dimensions: 2048,
    filterFields: ["metadata"],
  }),
  embeddings1536: defineTable(embeddings).vectorIndex("vector", {
    vectorField: "vector",
    dimensions: 1536,
    filterFields: ["metadata"],
  }),
  embeddings1024: defineTable(embeddings).vectorIndex("vector", {
    vectorField: "vector",
    dimensions: 1024,
    filterFields: ["metadata"],
  }),
  embeddings768: defineTable(embeddings).vectorIndex("vector", {
    vectorField: "vector",
    dimensions: 768,
    filterFields: ["metadata"],
  }),
  embeddings512: defineTable(embeddings).vectorIndex("vector", {
    vectorField: "vector",
    dimensions: 512,
    filterFields: ["metadata"],
  }),
  embeddings256: defineTable(embeddings).vectorIndex("vector", {
    vectorField: "vector",
    dimensions: 256,
    filterFields: ["metadata"],
  }),
  embeddings128: defineTable(embeddings).vectorIndex("vector", {
    vectorField: "vector",
    dimensions: 128,
    filterFields: ["metadata"],
  }),
};
