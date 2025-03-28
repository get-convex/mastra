import type { Mounts } from "../component/_generated/api.js";
import { UseApi } from "./types.js";
import { MastraVector } from "@mastra/core";
import { SupportedTableName } from "../component/vector/tables.js";
import {
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import { GenericActionCtx } from "convex/server";
export { InMemoryVector } from "./in-memory.js";

export class ConvexVector extends MastraVector {
  ctx: Ctx<"action" | "mutation" | "query"> | undefined;
  api: UseApi<Mounts>["vector"];

  constructor(
    component: UseApi<Mounts>,
    public options?: { name?: string }
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
          " before using the storage."
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

  async query(...args: Parameters<MastraVector["query"]>) {
    const { indexName, queryVector, topK, filter, includeVector } =
      this.normalizeArgs("query", args);
    const ctx = this.getApi("action");
    return await ctx.runAction(this.api.vector.search, {
      indexName,
      queryVector,
      topK: topK ?? 10,
      filter: filter ?? undefined,
      includeVector,
    });
  }

  async upsert(...args: Parameters<MastraVector["upsert"]>): Promise<string[]> {
    const { indexName, vectors, metadata, ids } = this.normalizeArgs(
      "upsert",
      args
    );
    const ctx = this.getApi("mutation");
    return await ctx.runMutation(this.api.vector.upsert, {
      indexName,
      vectors,
      metadata,
      ids,
    });
  }

  async createIndex(...args: Parameters<MastraVector["createIndex"]>) {
    const { indexName, dimension } = this.normalizeArgs("createIndex", args);
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

  async describeIndex(indexName: string) {
    const ctx = this.getApi("query");
    return await ctx.runQuery(this.api.vector.describeIndex, { indexName });
  }

  async deleteIndex(indexName: SupportedTableName) {
    const ctx = this.getApi("action");
    await ctx.runAction(this.api.vector.deleteIndex, { indexName });
  }
}

type Ctx<T extends "action" | "mutation" | "query"> = T extends "action"
  ? GenericActionCtx<GenericDataModel>
  : T extends "mutation"
    ? GenericMutationCtx<GenericDataModel>
    : T extends "query"
      ? GenericQueryCtx<GenericDataModel>
      : never;
