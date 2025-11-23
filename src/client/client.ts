import type {
  MessageType,
  StorageThreadType,
  WorkflowRuns,
} from "@mastra/core";
import type {
  EvalRow,
  StorageColumn,
  StorageGetMessagesArg,
} from "@mastra/core/storage";
import { MastraStorage, type TABLE_NAMES } from "@mastra/core/storage";
import { anyApi, type FunctionReference } from "convex/server";
import { mastraToConvexTableNames } from "../mapping/index.js";
import { ConvexHttpClient } from "convex/browser";

import { MastraVector } from "@mastra/core";
import type { SupportedTableName } from "../component/vector/tables.js";
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
    public options?: { name?: string; api?: VectorApi },
  ) {
    super();
    this.api = options?.api ?? (anyApi.mastra.api as unknown as VectorApi);
  }

  async query(params: Parameters<MastraVector["query"]>[0]) {
    const { indexName, queryVector, topK, filter, includeVector } = params;
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

  async upsert(params: Parameters<MastraVector["upsert"]>[0]): Promise<string[]> {
    const { indexName, vectors, metadata, ids } = params;
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

  async createIndex(params: Parameters<MastraVector["createIndex"]>[0]) {
    const { indexName, dimension } = params;
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

  async describeIndex(params: Parameters<MastraVector["describeIndex"]>[0]) {
    const { indexName } = params;
    return await this.client.query(this.api.vectorQuery, {
      op: "describeIndex",
      args: { indexName },
    });
  }

  async deleteIndex(params: Parameters<MastraVector["deleteIndex"]>[0]) {
    const { indexName } = params;
    await this.client.action(this.api.vectorAction, {
      op: "deleteIndex",
      args: { indexName: indexName as SupportedTableName },
    });
  }

  async updateVector(params: Parameters<MastraVector["updateVector"]>[0]): Promise<void> {
    const { indexName, id, update } = params;
    await this.client.action(this.api.vectorAction, {
      op: "updateVector",
      args: {
        indexName: indexName as SupportedTableName,
        id,
        ...update,
      },
    });
  }

  async deleteVector(params: Parameters<MastraVector["deleteVector"]>[0]): Promise<void> {
    const { indexName, id } = params;
    await this.client.action(this.api.vectorAction, {
      op: "deleteVector",
      args: {
        indexName: indexName as SupportedTableName,
        id,
      },
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
    options?: { name?: string; api?: StorageApi },
  ) {
    super({ name: options?.name ?? "ConvexStorage" });
    this.client = client;
    this.api = options?.api ?? (anyApi.mastra.api as unknown as StorageApi);
    this.shouldCacheInit = true;
  }

  async getWorkflowRuns(args?: {
    namespace?: string;
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<WorkflowRuns> {
    return await this.client.query(this.api.storageQuery, {
      op: "getWorkflowRuns",
      args,
    });
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
    type?: "test" | "live",
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
  }): Promise<any[]> {
    return await this.client.action(this.api.storageAction, {
      op: "getTraces",
      args: options,
    });
  }
}
