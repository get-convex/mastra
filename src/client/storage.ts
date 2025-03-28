// Workaround to aid in bundling, to be combined with adding @libsql/client to
// the externalPackages in a convex.json file in the root of your project.
export * as libsql from "@libsql/client";

import type { MessageType, StorageThreadType } from "@mastra/core";
import type {
  EvalRow,
  StorageColumn,
  StorageGetMessagesArg,
} from "@mastra/core/storage";
import {
  MastraStorage,
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_NAMES,
  TABLE_THREADS,
  TABLE_TRACES,
  TABLE_WORKFLOW_SNAPSHOT,
} from "@mastra/core/storage";
import type { Mounts } from "../component/_generated/api.js";
import {
  mapSerializedToMastra,
  mapMastraToSerialized,
  mastraToConvexTableNames,
  SerializedThread,
  SerializedMessage,
  SerializedTrace,
} from "../mapping/storage.js";
import { UseApi } from "./types.js";
import {
  GenericActionCtx,
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
export { InMemoryStorage } from "./in-memory.js";

export class ConvexStorage extends MastraStorage {
  ctx: Ctx<"action" | "mutation" | "query"> | undefined;
  api: UseApi<Mounts>["storage"];
  constructor(component: UseApi<Mounts>, options?: { name?: string }) {
    super({ name: options?.name ?? "ConvexStorage" });
    this.api = component.storage;
    this.shouldCacheInit = true;
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

  async createTable(args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    const convexTableName = mastraToConvexTableNames[args.tableName];
    if (!convexTableName) {
      throw new Error(`Unsupported table name: ${args.tableName}`);
    }
    // TODO: we could do more serious validation against the defined schema
    // validateTableSchema(convexTableName, tableSchema);
    return;
  }

  async clearTable(args: { tableName: TABLE_NAMES }): Promise<void> {
    const ctx = this.getApi("action");
    const tableName = mastraToConvexTableNames[args.tableName];
    await ctx.runAction(this.api.storage.clearTable, { tableName });
    return;
  }

  async insert(args: {
    tableName: TABLE_NAMES;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    record: Record<string, any>;
  }): Promise<void> {
    const convexRecord = mapMastraToSerialized(args.tableName, args.record);
    const tableName = mastraToConvexTableNames[args.tableName];
    const ctx = this.getApi("mutation");
    await ctx.runMutation(this.api.storage.insert, {
      tableName,
      document: convexRecord,
    });
    return;
  }

  async batchInsert(args: {
    tableName: TABLE_NAMES;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    records: Record<string, any>[];
  }): Promise<void> {
    const ctx = this.getApi("mutation");
    const tableName = mastraToConvexTableNames[args.tableName];
    await ctx.runMutation(this.api.storage.batchInsert, {
      tableName,
      records: args.records.map((record) =>
        mapMastraToSerialized(args.tableName, record)
      ),
    });
    return;
  }

  async load<R>(args: {
    tableName: TABLE_NAMES;
    keys: Record<string, string>;
  }): Promise<R | null> {
    const ctx = this.getApi("query");
    const tableName = mastraToConvexTableNames[args.tableName];
    if (args.tableName === TABLE_WORKFLOW_SNAPSHOT) {
      const { run_id, workflow_name } = args.keys;
      if (!run_id || !workflow_name) {
        throw new Error("Expected run_id and workflow_name to load a snapshot");
      }
      const snapshot = await ctx.runQuery(this.api.storage.loadSnapshot, {
        runId: run_id,
        workflowName: workflow_name,
      });
      if (!snapshot) {
        return null;
      }
      return mapSerializedToMastra(args.tableName, snapshot) as R;
    }
    return await ctx.runQuery(this.api.storage.load, {
      tableName,
      keys: args.keys,
    });
  }

  async getThreadById({
    threadId,
  }: {
    threadId: string;
  }): Promise<StorageThreadType | null> {
    const ctx = this.getApi("query");
    const thread = await ctx.runQuery(this.api.messages.getThreadById, {
      threadId,
    });
    if (!thread) {
      return null;
    }
    return mapSerializedToMastra(TABLE_THREADS, thread);
  }

  async getThreadsByResourceId({
    resourceId,
  }: {
    resourceId: string;
  }): Promise<StorageThreadType[]> {
    const ctx = this.getApi("query");
    const threads: SerializedThread[] = [];
    let cursor: string | null = null;
    while (true) {
      const page: {
        threads: SerializedThread[];
        continueCursor: string;
        isDone: boolean;
      } = await ctx.runQuery(this.api.messages.getThreadsByResourceId, {
        resourceId,
        cursor,
      });
      threads.push(...page.threads);
      if (page.isDone) {
        break;
      }
      cursor = page.continueCursor;
    }
    return threads.map((thread) =>
      mapSerializedToMastra(TABLE_THREADS, thread)
    );
  }

  async saveThread({
    thread,
  }: {
    thread: StorageThreadType;
  }): Promise<StorageThreadType> {
    const ctx = this.getApi("mutation");
    await ctx.runMutation(this.api.messages.saveThread, {
      thread: mapMastraToSerialized(TABLE_THREADS, thread),
    });
    return thread;
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
    const ctx = this.getApi("mutation");
    const thread = await ctx.runMutation(this.api.messages.updateThread, {
      threadId: id,
      title,
      metadata,
    });
    return mapSerializedToMastra(TABLE_THREADS, thread);
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const ctx = this.getApi("mutation");
    await ctx.runMutation(this.api.messages.deleteThread, { threadId });
    return;
  }

  async getMessages<T extends MessageType>({
    threadId,
    selectBy,
  }: StorageGetMessagesArg): Promise<T[]> {
    const ctx = this.getApi("query");
    const messages: SerializedMessage[] = await ctx.runQuery(
      this.api.messages.getMessagesPage,
      {
        threadId,
        selectBy,
        // memoryConfig: threadConfig,
      }
    );
    return messages.map((message) =>
      mapSerializedToMastra(TABLE_MESSAGES, message)
    ) as T[];
  }

  async saveMessages({
    messages,
  }: {
    messages: MessageType[];
  }): Promise<MessageType[]> {
    const ctx = this.getApi("mutation");
    await ctx.runMutation(this.api.messages.saveMessages, {
      messages: messages.map((message) =>
        mapMastraToSerialized(TABLE_MESSAGES, message)
      ),
    });
    return messages;
  }

  async getEvalsByAgentName(
    agentName: string,
    type?: "test" | "live"
  ): Promise<EvalRow[]> {
    const ctx = this.getApi("query");
    const evals = await ctx.runQuery(this.api.storage.getEvalsByAgentName, {
      agentName,
      type,
    });
    return evals.map((e) => mapSerializedToMastra(TABLE_EVALS, e));
  }

  async getTraces(options?: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): Promise<any[]> {
    const { name, scope, page, perPage, attributes } = options ?? {};
    const traces: SerializedTrace[] = [];
    let cursor: string | null = null;
    const numItems = perPage ?? 100;
    const pageNum = page ?? 0;
    while (true) {
      const ctx = this.getApi("query");
      const results: {
        isDone: boolean;
        continuCursor: string;
        page: SerializedTrace[];
      } = await ctx.runQuery(this.api.storage.getTracesPage, {
        name,
        scope,
        cursor,
        numItems,
        attributes,
      });
      traces.push(...results.page);
      // Note: we'll refetch from the beginning on every page.
      if (results.isDone || traces.length >= numItems * pageNum) {
        break;
      }
      cursor = results.continuCursor;
    }
    return traces
      .slice(pageNum * numItems, (pageNum + 1) * numItems)
      .map((trace) => mapSerializedToMastra(TABLE_TRACES, trace));
  }
}

type Ctx<T extends "action" | "mutation" | "query"> = T extends "action"
  ? GenericActionCtx<GenericDataModel>
  : T extends "mutation"
    ? GenericMutationCtx<GenericDataModel>
    : T extends "query"
      ? GenericQueryCtx<GenericDataModel>
      : never;
