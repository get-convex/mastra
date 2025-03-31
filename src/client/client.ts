import type { MessageType, StorageThreadType } from "@mastra/core";
import type {
  EvalRow,
  StorageColumn,
  StorageGetMessagesArg,
} from "@mastra/core/storage";
import { MastraStorage, TABLE_NAMES } from "@mastra/core/storage";
import { anyApi, FunctionReference } from "convex/server";
import { mastraToConvexTableNames } from "../mapping/index.js";
import { ConvexHttpClient } from "convex/browser";

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

export type VectorApi = {
  vectorAction: FunctionReference<"action">;
  vectorMutation: FunctionReference<"mutation">;
  vectorQuery: FunctionReference<"query">;
};
export class ConvexVector extends MastraVector {
  api: VectorApi;

  constructor(
    public client: ConvexHttpClient,
    public options?: { name?: string; api?: VectorApi }
  ) {
    super();
    this.api = options?.api ?? (anyApi.mastra.api as unknown as VectorApi);
  }

  async query(...args: Parameters<MastraVector["query"]>) {
    const { indexName, queryVector, topK, filter, includeVector } =
      this.normalizeArgs("query", args);
    return await this.client.action(this.api.vectorAction, {
      op: "search",
      args: {
        indexName,
        queryVector,
        topK: topK ?? 10,
        filter: filter ?? undefined,
        includeVector,
      },
    });
  }

  async upsert(...args: Parameters<MastraVector["upsert"]>): Promise<string[]> {
    const { indexName, vectors, metadata, ids } = this.normalizeArgs(
      "upsert",
      args
    );
    return await this.client.action(this.api.vectorAction, {
      op: "upsert",
      args: {
        indexName,
        vectors,
        metadata,
        ids,
      },
    });
  }

  async createIndex(...args: Parameters<MastraVector["createIndex"]>) {
    const { indexName, dimension } = this.normalizeArgs("createIndex", args);
    if (dimension !== 1536) {
      throw new Error("Only 1536 dimensions supported");
    }
    await this.client.action(this.api.vectorAction, {
      op: "createIndex",
      args: {
        indexName,
        dimensions: dimension,
      },
    });
  }

  async listIndexes() {
    return await this.client.query(this.api.vectorQuery, {
      op: "listIndexes",
      args: {},
    });
  }

  async describeIndex(indexName: string) {
    return await this.client.query(this.api.vectorQuery, {
      op: "describeIndex",
      args: { indexName },
    });
  }

  async deleteIndex(indexName: SupportedTableName) {
    await this.client.action(this.api.vectorAction, {
      op: "deleteIndex",
      args: { indexName },
    });
  }
}

export type StorageApi = {
  storageAction: FunctionReference<"action">;
  storageMutation: FunctionReference<"mutation">;
  storageQuery: FunctionReference<"query">;
};

export class ConvexStorage extends MastraStorage {
  client: ConvexHttpClient;
  api: StorageApi;
  constructor(
    client: ConvexHttpClient,
    options?: { name?: string; api?: StorageApi }
  ) {
    super({ name: options?.name ?? "ConvexStorage" });
    this.client = client;
    this.api = options?.api ?? (anyApi.mastra.api as unknown as StorageApi);
    this.shouldCacheInit = true;
  }

  async createTable(args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    const convexTableName = mastraToConvexTableNames[args.tableName];
    if (!convexTableName) {
      throw new Error(`Unsupported table name: ${args.tableName}`);
    }
    // TODO: we could do more serious validation against the defined schema
    // await this.client.mutation(this.api.storageMutation, {
    //   op: "createTable",
    //   args,
    // });
  }

  async clearTable(args: { tableName: TABLE_NAMES }): Promise<void> {
    await this.client.action(this.api.storageAction, {
      op: "clearTable",
      args,
    });
  }

  async insert(args: {
    tableName: TABLE_NAMES;
    record: Record<string, unknown>;
  }): Promise<void> {
    await this.client.mutation(this.api.storageMutation, {
      op: "insert",
      args,
    });
    return;
  }

  async batchInsert(args: {
    tableName: TABLE_NAMES;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    records: Record<string, any>[];
  }): Promise<void> {
    await this.client.mutation(this.api.storageMutation, {
      op: "batchInsert",
      args,
    });
  }

  async load<R>(args: {
    tableName: TABLE_NAMES;
    keys: Record<string, string>;
  }): Promise<R | null> {
    return await this.client.query(this.api.storageQuery, {
      op: "load",
      args,
    });
  }

  async getThreadById({
    threadId,
  }: {
    threadId: string;
  }): Promise<StorageThreadType | null> {
    return await this.client.query(this.api.storageQuery, {
      op: "getThreadById",
      args: { threadId },
    });
  }

  async getThreadsByResourceId({
    resourceId,
  }: {
    resourceId: string;
  }): Promise<StorageThreadType[]> {
    return await this.client.query(this.api.storageQuery, {
      op: "getThreadsByResourceId",
      args: { resourceId },
    });
  }

  async saveThread({
    thread,
  }: {
    thread: StorageThreadType;
  }): Promise<StorageThreadType> {
    return await this.client.mutation(this.api.storageMutation, {
      op: "saveThread",
      args: { thread },
    });
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    return await this.client.mutation(this.api.storageMutation, {
      op: "updateThread",
      args: { id, title, metadata },
    });
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    await this.client.mutation(this.api.storageMutation, {
      op: "deleteThread",
      args: { threadId },
    });
  }

  async getMessages<T extends MessageType>({
    threadId,
    selectBy,
  }: StorageGetMessagesArg): Promise<T[]> {
    return await this.client.query(this.api.storageQuery, {
      op: "getMessages",
      args: { threadId, selectBy },
    });
  }

  async saveMessages({
    messages,
  }: {
    messages: MessageType[];
  }): Promise<MessageType[]> {
    return await this.client.mutation(this.api.storageMutation, {
      op: "saveMessages",
      args: { messages },
    });
  }

  async getEvalsByAgentName(
    agentName: string,
    type?: "test" | "live"
  ): Promise<EvalRow[]> {
    return await this.client.query(this.api.storageQuery, {
      op: "getEvalsByAgentName",
      args: { agentName, type },
    });
  }

  async getTraces(options?: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): Promise<any[]> {
    return await this.client.action(this.api.storageAction, {
      op: "getTraces",
      args: options,
    });
  }
}
