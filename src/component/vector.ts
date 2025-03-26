/**
 * Implement the API based on ../storage/storage.ts, using and editing the tables in ./tables.ts
 * and providing an API that matches this abstract class, but not importing any Mastra* classes or from @mastra/core or @mastra/core/mastra or @mastra/core/vector
 */

import { v } from "convex/values";
import {
  action,
  query,
  mutation,
  internalQuery,
  internalMutation,
  QueryCtx,
} from "./_generated/server";
import {
  SUPPORTED_DIMENSIONS,
  SupportedDimension,
  vSupportedDimension,
  vSupportedId,
  vSupportedTableName,
} from "./tables";
import { internal } from "./_generated/api";
import { paginator } from "convex-helpers/server/pagination";
import schema from "./schema";

export const createIndex = mutation({
  args: { indexName: v.string(), dimensions: vSupportedDimension },
  handler: async (ctx, { indexName, dimensions }) => {
    // For now only validate that it maches one of the supported sizes
    if (!SUPPORTED_DIMENSIONS.includes(dimensions)) {
      throw new Error(`Unsupported index size: ${indexName}`);
    }
    const existing = await ctx.db
      .query("indexTableMap")
      .withIndex("indexName", (q) => q.eq("indexName", indexName))
      .first();
    if (existing) {
      if (existing.dimensions !== dimensions) {
        throw new Error("Index already exists with different dimensions");
      }
      console.warn(`Index ${indexName} already exists, not creating...`);
      return;
    }
    console.log(`Creating index ${indexName} with dimensions ${dimensions}`);
    await ctx.db.insert("indexTableMap", {
      indexName,
      tableName: `embeddings_${dimensions}`,
      dimensions: dimensions,
    });
  },
});

function getIndexMetadata(ctx: QueryCtx, name: string) {
  return ctx.db
    .query("indexTableMap")
    .withIndex("indexName", (q) => q.eq("indexName", name))
    .order("desc")
    .first();
}

export const getIndexMetadataQuery = internalQuery({
  args: { indexName: v.string() },
  handler: async (ctx, args) => {
    return await getIndexMetadata(ctx, args.indexName);
  },
});

export const upsert = mutation({
  args: {
    indexName: v.string(),
    vectors: v.array(v.array(v.number())),
    metadata: v.optional(v.array(v.record(v.string(), v.any()))),
    ids: v.optional(v.array(v.string())),
  },
  returns: v.array(v.string()),
  handler: async (
    ctx,
    { indexName, vectors, metadata, ids }
  ): Promise<string[]> => {
    const index = await ctx.runQuery(
      internal.vector.vector.getIndexMetadataQuery,
      {
        indexName,
      }
    );
    if (!index) {
      throw new Error("Index not found");
    }
    const dimensions = index.dimensions;
    if (!vectors.every((v) => v.length === dimensions)) {
      throw new Error(`All vectors must have ${dimensions} dimensions`);
    }
    if (metadata && vectors.length !== metadata.length) {
      throw new Error("vectors and metadata must have same length");
    }
    if (ids && vectors.length !== ids.length) {
      throw new Error("vectors and ids must have same length");
    }

    // Batch insert all vectors
    return await Promise.all(
      vectors.map(async (vector, i) => {
        const id = ids?.[i];
        if (id) {
          const convexId = ctx.db.normalizeId(index.tableName, id);
          const existing = convexId
            ? await ctx.db.get(convexId)
            : await ctx.db
                .query(index.tableName)
                .withIndex("id", (q) => q.eq("id", id))
                .first();
          if (existing) {
            await ctx.db.patch(existing._id, {
              vector,
              metadata: metadata?.[i],
            });
            return existing.id ?? existing._id;
          }
        }
        const newId = await ctx.db.insert(index.tableName, {
          id,
          vector,
          metadata: metadata?.[i],
          indexName,
        });
        if (!id) {
          await ctx.db.patch(newId, {
            id: newId,
          });
        }
        return id ?? newId;
      })
    );
  },
});

export const search = action({
  args: {
    indexName: v.string(),
    queryVector: v.array(v.number()),
    topK: v.number(),
    filter: v.optional(v.record(v.string(), v.any())),
    includeVector: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { indexName, queryVector, topK, filter, includeVector }
  ): Promise<SearchResult[]> => {
    const index = await ctx.runQuery(
      internal.vector.vector.getIndexMetadataQuery,
      {
        indexName,
      }
    );
    if (!index) {
      throw new Error("Index not found");
    }
    const dimensions = index.dimensions;
    if (queryVector.length !== dimensions) {
      throw new Error(`Query vector must have ${dimensions} dimensions`);
    }

    const results = await ctx.vectorSearch(index.tableName, "vector", {
      vector: queryVector,
      limit: Math.max(topK * 10 * Object.keys(filter ?? {}).length, 1024),
      filter: filter
        ? (q) => {
            return q.eq("indexName", index.indexName);
          }
        : undefined,
    });

    const entries = await ctx.runQuery(internal.vector.vector.lookupResults, {
      ids: results.map((r) => r._id),
      scores: results.map((r) => r._score),
      includeVector: includeVector ?? false,
    });

    const filtered = entries.filter((r) => {
      if (filter) {
        return Object.entries(filter).every(([key, value]) => {
          return r.metadata?.[key] === value;
        });
      }
      return true;
    });

    return filtered;
  },
});

type SearchResult = {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
  vector?: number[];
};

export const lookupResults = internalQuery({
  args: {
    ids: v.array(vSupportedId),
    scores: v.array(v.number()),
    includeVector: v.boolean(),
  },
  handler: async (ctx, args): Promise<SearchResult[]> => {
    if (args.ids.length !== args.scores.length) {
      throw new Error("ids and scores must have same length");
    }
    const results = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
    return results.flatMap((r, i) =>
      r
        ? [
            {
              id: r._id,
              score: args.scores[i],
              metadata: r.metadata,
              vector: args.includeVector ? r.vector : undefined,
            },
          ]
        : []
    );
  },
});

export const listIndexes = query({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    return (await ctx.db.query("indexTableMap").collect()).map(
      (i) => i.indexName
    );
  },
});

export const describeIndex = query({
  args: { indexName: v.string() },
  handler: async (ctx, { indexName }) => {
    const index = await getIndexMetadata(ctx, indexName);
    if (!index) {
      throw new Error("Index not found");
    }
    const dimensions = index.dimensions;
    if (!SUPPORTED_DIMENSIONS.includes(dimensions)) {
      throw new Error("Invalid index name");
    }
    return {
      dimension: dimensions,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      count: await (ctx.db.query(index.tableName) as any).count(),
      metric: "cosine" as const,
    };
  },
});

export const deleteIndex = action({
  args: { indexName: v.string() },
  handler: async (ctx, { indexName }) => {
    const index = await ctx.runQuery(
      internal.vector.vector.getIndexMetadataQuery,
      {
        indexName,
      }
    );
    if (!index) {
      console.warn(`Index ${indexName} not found, not deleting...`);
      return;
    }
    let cursor: string | null = null;
    while (true) {
      const results: PageResult = await ctx.runMutation(
        internal.vector.vector.deletePage,
        {
          indexName: index.tableName,
          cursor,
        }
      );
      if (results.isDone) break;
      cursor = results.continueCursor;
    }
  },
});

type PageResult = {
  isDone: boolean;
  continueCursor: string;
};

export const deletePage = internalMutation({
  args: {
    indexName: vSupportedTableName,
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { indexName, cursor }): Promise<PageResult> => {
    const dimensions = parseInt(indexName.split("_")[1]) as SupportedDimension;
    if (!SUPPORTED_DIMENSIONS.includes(dimensions)) {
      throw new Error("Invalid index name");
    }
    const docs = await paginator(ctx.db, schema).query(indexName).paginate({
      cursor,
      numItems: 1000,
    });
    await Promise.all(docs.page.map((doc) => ctx.db.delete(doc._id)));
    return {
      isDone: docs.isDone,
      continueCursor: docs.continueCursor,
    };
  },
});
