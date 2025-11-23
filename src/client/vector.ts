import { MastraVector } from "@mastra/core";
import type { SupportedTableName } from "../component/vector/tables.js";
import type {
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import type { GenericActionCtx } from "convex/server";
import type { ComponentApi } from "../component/_generated/component.js";
export { InMemoryVector } from "./in-memory.js";

export class ConvexVector extends MastraVector {
  ctx: Ctx<"action" | "mutation" | "query"> | undefined;
  api: ComponentApi["vector"];

  constructor(
    component: ComponentApi,
    public options?: { name?: string },
  ) {
    super();
    this.api = component.vector;
  }

  /**
   * Set the context for the storage. Must be called before using the storage
   * in a Convex function. If you are using the storage via the API, you do not
   * need to call this.
   *
   * @param ctx - The context to use for the storage.
   */
  async setCtx(ctx: Ctx<"action" | "mutation" | "query"> | undefined) {
    this.ctx = ctx;
  }

  getApi<T extends "action" | "mutation" | "query">(kind: T): Ctx<T> {
    // TODO: get http client if that's specified
    if (!this.ctx) {
      throw new Error(
        "Context not set: ensure you're calling storage.setCtx" +
          " before using the storage.",
      );
    }
    switch (kind) {
      case "action":
        if (!(this.ctx as GenericActionCtx<GenericDataModel>).runAction) {
          throw new Error("Context must be an action context to do this");
        }
      // fallthrough
      case "mutation":
        if (!(this.ctx as GenericMutationCtx<GenericDataModel>).runMutation) {
          throw new Error("Context doesn't have a way to run mutations");
        }
      // fallthrough
      case "query":
        if (!(this.ctx as GenericQueryCtx<GenericDataModel>).runQuery) {
          throw new Error("Context is not a query context");
        }
    }
    return this.ctx as Ctx<T>;
  }

  async query(params: Parameters<MastraVector["query"]>[0]) {
    const { indexName, queryVector, topK, filter, includeVector } = params;
    const ctx = this.getApi("action");
    return await ctx.runAction(this.api.vector.search, {
      indexName,
      queryVector,
      topK: topK ?? 10,
      filter: filter ?? undefined,
      includeVector,
    });
  }

  async upsert(params: Parameters<MastraVector["upsert"]>[0]): Promise<string[]> {
    const { indexName, vectors, metadata, ids } = params;
    const ctx = this.getApi("mutation");
    return await ctx.runMutation(this.api.vector.upsert, {
      indexName,
      vectors,
      metadata,
      ids,
    });
  }

  async createIndex(params: Parameters<MastraVector["createIndex"]>[0]) {
    const { indexName, dimension } = params;
    if (dimension !== 1536) {
      throw new Error("Only 1536 dimensions supported");
    }
    const ctx = this.getApi("mutation");
    await ctx.runMutation(this.api.vector.createIndex, {
      indexName,
      dimensions: dimension,
    });
  }

  async listIndexes() {
    const ctx = this.getApi("query");
    return await ctx.runQuery(this.api.vector.listIndexes, {});
  }

  async describeIndex(params: Parameters<MastraVector["describeIndex"]>[0]) {
    const { indexName } = params;
    const ctx = this.getApi("query");
    return await ctx.runQuery(this.api.vector.describeIndex, { indexName });
  }

  async deleteIndex(params: Parameters<MastraVector["deleteIndex"]>[0]) {
    const { indexName } = params;
    const ctx = this.getApi("action");
    await ctx.runAction(this.api.vector.deleteIndex, { indexName: indexName as SupportedTableName });
  }

  async updateVector(params: Parameters<MastraVector["updateVector"]>[0]): Promise<void> {
    const { indexName, id, update } = params;
    const ctx = this.getApi("mutation");
    await ctx.runMutation(this.api.vector.updateVector, {
      indexName: indexName as SupportedTableName,
      id,
      ...update,
    });
  }

  async deleteVector(params: Parameters<MastraVector["deleteVector"]>[0]): Promise<void> {
    const { indexName, id } = params;
    const ctx = this.getApi("mutation");
    await ctx.runMutation(this.api.vector.deleteVector, {
      indexName: indexName as SupportedTableName,
      id,
    });
  }
}

type Ctx<T extends "action" | "mutation" | "query"> = T extends "action"
  ? GenericActionCtx<GenericDataModel>
  : T extends "mutation"
    ? GenericMutationCtx<GenericDataModel>
    : T extends "query"
      ? GenericQueryCtx<GenericDataModel>
      : never;
