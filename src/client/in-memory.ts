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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/**
 * InMemoryStorage is a simple in-memory storage implementation for Mastra.
 * It is used for testing and development purposes.
 */
export class InMemoryStorage extends MastraStorage {
  private tables: Record<TABLE_NAMES, Row[]> = {
    [TABLE_WORKFLOW_SNAPSHOT]: [],
    [TABLE_EVALS]: [],
    [TABLE_MESSAGES]: [],
    [TABLE_THREADS]: [],
    [TABLE_TRACES]: [],
  };
  private primaryKeys: Record<TABLE_NAMES, string | null> = {
    [TABLE_WORKFLOW_SNAPSHOT]: null,
    [TABLE_EVALS]: null,
    [TABLE_MESSAGES]: null,
    [TABLE_THREADS]: null,
    [TABLE_TRACES]: null,
  };
  constructor() {
    super({ name: "InMemoryStorage" });
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }) {
    for (const [key, value] of Object.entries(schema)) {
      if (value.primaryKey) {
        this.primaryKeys[tableName] = key;
      }
      break;
    }
    return;
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }) {
    this.tables[tableName] = [];
  }

  // We make this a non-async function so all inserts can happen transactionally
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _insert(tableName: TABLE_NAMES, record: Record<string, any>) {
    if (this.primaryKeys[tableName]) {
      const primaryKey = record[this.primaryKeys[tableName]!];
      const index = this.tables[tableName].findIndex(
        (record) => record[this.primaryKeys[tableName]!] === primaryKey
      );
      if (index !== -1) {
        this.tables[tableName][index] = record;
      } else {
        this.tables[tableName].push(record);
      }
    } else {
      this.tables[tableName].push(record);
    }
  }

  async insert({
    tableName,
    record,
  }: {
    tableName: TABLE_NAMES;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    record: Record<string, any>;
  }) {
    this._insert(tableName, record);
  }

  async batchInsert({
    tableName,
    records,
  }: {
    tableName: TABLE_NAMES;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    records: Record<string, any>[];
  }) {
    records.forEach((record) => this._insert(tableName, record));
  }

  async load<R>({
    tableName,
    keys,
  }: {
    tableName: TABLE_NAMES;
    keys: Record<string, string>;
  }): Promise<R | null> {
    return this.tables[tableName].find((record) =>
      Object.entries(keys).every(([key, value]) => record[key] === value)
    ) as R | null;
  }

  async getThreadById({
    threadId,
  }: {
    threadId: string;
  }): Promise<StorageThreadType | null> {
    return this.tables[TABLE_THREADS].find(
      (record) => record.id === threadId
    ) as StorageThreadType | null;
  }

  async getThreadsByResourceId({
    resourceId,
  }: {
    resourceId: string;
  }): Promise<StorageThreadType[]> {
    return this.tables[TABLE_THREADS].filter(
      (record) => record.resourceId === resourceId
    ) as StorageThreadType[];
  }

  async saveThread({
    thread,
  }: {
    thread: StorageThreadType;
  }): Promise<StorageThreadType> {
    this._insert(TABLE_THREADS, thread);
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
    const index = this.tables[TABLE_THREADS].findIndex(
      (record) => record.id === id
    );
    if (index === -1) {
      throw new Error(`Thread with id ${id} not found`);
    }
    this.tables[TABLE_THREADS][index] = {
      ...this.tables[TABLE_THREADS][index],
      title,
      metadata,
    };
    return this.tables[TABLE_THREADS][index] as StorageThreadType;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const index = this.tables[TABLE_THREADS].findIndex(
      (record) => record.id === threadId
    );
    if (index !== -1) {
      this.tables[TABLE_THREADS].splice(index, 1);
    }
  }

  async getMessages<T extends MessageType[]>({
    threadId,
    selectBy,
  }: StorageGetMessagesArg): Promise<T> {
    const allMessages = this.tables[TABLE_MESSAGES].filter(
      (record) => record.threadId === threadId
    ) as MessageType[];
    const limit = typeof selectBy?.last === `number` ? selectBy.last : 40;
    const ranges = [
      { start: allMessages.length - limit, end: allMessages.length },
    ];
    if (selectBy?.include?.length) {
      ranges.push(
        ...selectBy.include
          .map((i) => {
            const index = allMessages.findIndex((record) => record.id === i.id);
            return index !== -1
              ? {
                  start: index - (i.withPreviousMessages || 0),
                  end: index + (i.withNextMessages || 0),
                }
              : null;
          })
          .flatMap((r) => (r ? [r] : []))
      );
    }
    const indexes = ranges
      .flatMap((r) =>
        Array.from({ length: r.end - r.start + 1 }, (_, i) => r.start + i)
      )
      .sort()
      .reduce(
        (acc, index) => (acc.at(-1) === index ? acc : [...acc, index]),
        [] as number[]
      );
    return indexes
      .map((index) => allMessages[index]!)
      .map((m) => ({
        ...m,
        content: tryJSONParse(m.content),
        createdAt: new Date(m.createdAt),
      })) as T;
  }

  async saveMessages({
    messages,
  }: {
    messages: MessageType[];
  }): Promise<MessageType[]> {
    messages.forEach((message) =>
      this._insert(TABLE_MESSAGES, {
        id: message.id,
        threadId: message.threadId,
        content:
          typeof message.content === "object"
            ? JSON.stringify(message.content)
            : message.content,
        role: message.role,
        type: message.type,
        createdAt:
          message.createdAt instanceof Date
            ? message.createdAt.toISOString()
            : message.createdAt || new Date().toISOString(),
      })
    );
    return messages;
  }

  async getTraces(args: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): Promise<any[]> {
    const { name, scope, page, perPage, attributes } = args;
    const limit = perPage;
    const offset = page * perPage;
    const traces = this.tables[TABLE_TRACES].filter((record) => {
      if (name && !record.name.startsWith(name)) {
        return false;
      }
      if (scope && record.scope !== scope) {
        return false;
      }
      if (attributes) {
        return Object.keys(attributes).every(
          (key) => record.attributes[key] === attributes[key]
        );
      }
      return true;
    });
    return traces.slice(offset, offset + limit);
  }

  async getEvalsByAgentName(
    agentName: string,
    type?: "test" | "live"
  ): Promise<EvalRow[]> {
    return this.tables[TABLE_EVALS].filter(
      (record) =>
        record.agentName === agentName &&
        (type === "test"
          ? record.testInfo && record.testInfo.testPath
          : type === "live"
            ? !record.testInfo || !record.testInfo.testPath
            : true)
    ) as EvalRow[];
  }
}

function tryJSONParse(content: unknown) {
  try {
    return JSON.parse(content as string);
  } catch {
    return content;
  }
}

/**
 * InMemoryVector is a simple in-memory vector implementation for Mastra.
 * It is used for testing and development purposes.
 */
import type {
  CreateIndexParams,
  UpsertVectorParams,
  QueryVectorParams,
  IndexStats,
  ParamsToArgs,
  QueryResult,
  CreateIndexArgs,
  UpsertVectorArgs,
  QueryVectorArgs,
} from "@mastra/core/vector";
import { MastraVector } from "@mastra/core/vector";
type VectorDoc = {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
};

export class InMemoryVector extends MastraVector {
  private tables: Record<string, VectorDoc[]> = {};
  private dimensions: Record<string, number> = {};
  constructor() {
    super();
  }
  async query<E extends QueryVectorArgs = QueryVectorArgs>(
    ...args: ParamsToArgs<QueryVectorParams> | E
  ): Promise<QueryResult[]> {
    const params = this.normalizeArgs<QueryVectorParams, QueryVectorArgs>(
      "query",
      args
    );
    const index = this.tables[params.indexName];
    if (!index) return [];
    const scored = index
      .filter(
        (doc) =>
          !params.filter ||
          Object.entries(params.filter).every(
            ([field, value]) => doc.metadata[field] === value
          )
      )
      .map((doc) => {
        const score = dotProduct(doc.vector, params.queryVector);
        return { score, doc };
      });
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, params.topK)
      .map((scored) => ({
        id: scored.doc.id,
        score: scored.score,
        ...scored.doc.metadata,
        ...(params.includeVector ? { vector: scored.doc.vector } : {}),
      }));
  }
  // Adds type checks for positional arguments if used
  async upsert<E extends UpsertVectorArgs = UpsertVectorArgs>(
    ...args: ParamsToArgs<UpsertVectorParams> | E
  ): Promise<string[]> {
    const params = this.normalizeArgs<UpsertVectorParams, UpsertVectorArgs>(
      "upsert",
      args
    );
    const table = this.tables[params.indexName];
    if (!table) throw new Error(`Index ${params.indexName} not found`);
    const normalized = params.vectors.map((vector, index) => {
      if (vector.length !== this.dimensions[params.indexName]) {
        throw new Error(
          `Vector ${index} has wrong dimension: ${vector.length} !== ${this.dimensions[params.indexName]}`
        );
      }
      // Normalize the vector to unit length
      return vector.map(
        (value) => value / Math.sqrt(dotProduct(vector, vector))
      );
    });

    const ids = params.ids || params.vectors.map(() => crypto.randomUUID());
    normalized.forEach((vector, index) => {
      const existing = table.find((doc) => doc.id === ids[index]);
      if (existing) {
        existing.vector = vector;
        existing.metadata = params.metadata?.[index] ?? {};
      } else {
        table.push({
          id: ids[index]!,
          vector,
          metadata: params.metadata?.[index] ?? {},
        });
      }
    });
    return ids;
  }
  // Adds type checks for positional arguments if used
  async createIndex<E extends CreateIndexArgs = CreateIndexArgs>(
    ...args: ParamsToArgs<CreateIndexParams> | E
  ): Promise<void> {
    const params = this.normalizeArgs<CreateIndexParams, CreateIndexArgs>(
      "createIndex",
      args
    );
    this.tables[params.indexName] = [];
    this.dimensions[params.indexName] = params.dimension;
  }

  async listIndexes(): Promise<string[]> {
    return Object.keys(this.tables);
  }

  async describeIndex(indexName: string): Promise<IndexStats> {
    const table = this.tables[indexName];
    const dimension = this.dimensions[indexName];
    if (!table) throw new Error(`Index ${indexName} not found`);
    if (!dimension) throw new Error(`Index ${indexName} has no dimension`);
    return {
      dimension,
      metric: "cosine",
      count: table.length,
    };
  }

  async deleteIndex(indexName: string): Promise<void> {
    delete this.tables[indexName];
    delete this.dimensions[indexName];
  }
}

function dotProduct(a: number[], b: number[]): number {
  return sum(a.map((value, index) => (b[index] ? value * b[index] : 0)));
}

function sum(a: number[]): number {
  return a.reduce((acc, curr) => acc + curr, 0);
}
