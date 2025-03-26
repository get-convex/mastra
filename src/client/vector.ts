import { ActionCtx } from "../component/_generated/server.js";
import type { api as componentApi } from "../component/_generated/api.js";
import { UseApi } from "./types.js";
import { MastraVector } from "@mastra/core";
import { SupportedTableName } from "../component/tables.js";
export { InMemoryVector } from "./in-memory.js";

export class ConvexVector extends MastraVector {
  public ctx: ActionCtx | undefined;
  public api: UseApi<typeof componentApi>["vector"];

  constructor(
    component: UseApi<typeof componentApi>,
    public options?: { name?: string }
  ) {
    super();
    this.api = component.vector;
  }

  getApi(): ActionCtx {
    if (!this.ctx) {
      throw new Error(
        "Context not set: ensure you're specifying the agents you" +
          " use to the Convex WorkflowRegistry.register function options argument."
      );
    }
    return this.ctx;
  }

  async query(...args: Parameters<MastraVector["query"]>) {
    const { indexName, queryVector, topK, filter, includeVector } =
      this.normalizeArgs("query", args);
    const ctx = this.getApi();
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
    const ctx = this.getApi();
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
    const ctx = this.getApi();
    await ctx.runMutation(this.api.vector.createIndex, {
      indexName,
      dimensions: dimension,
    });
  }

  async listIndexes() {
    const ctx = this.getApi();
    return await ctx.runQuery(this.api.vector.listIndexes, {});
  }

  async describeIndex(indexName: string) {
    const ctx = this.getApi();
    return await ctx.runQuery(this.api.vector.describeIndex, { indexName });
  }

  async deleteIndex(indexName: SupportedTableName) {
    const ctx = this.getApi();
    await ctx.runAction(this.api.vector.deleteIndex, { indexName });
  }
}
