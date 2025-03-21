import type {
  EvalRow,
  MessageType,
  StorageThreadType,
  WorkflowRow,
} from "@mastra/core";
import type {
  AssistantContent,
  DataContent,
  ToolContent,
  UserContent,
} from "ai";
import { v } from "convex/values";
import { SerializeUrlsAndUint8Arrays, vContent } from "./ai/types";

const TABLE_WORKFLOW_SNAPSHOT = "mastra_workflow_snapshot";
const TABLE_EVALS = "mastra_evals";
const TABLE_MESSAGES = "mastra_messages";
const TABLE_THREADS = "mastra_threads";
const TABLE_TRACES = "mastra_traces";
export type TABLE_NAMES =
  | typeof TABLE_WORKFLOW_SNAPSHOT
  | typeof TABLE_EVALS
  | typeof TABLE_MESSAGES
  | typeof TABLE_THREADS
  | typeof TABLE_TRACES;

// Define the runtime constants first
export const mastraToConvexTableNames = {
  [TABLE_WORKFLOW_SNAPSHOT]: "snapshots",
  [TABLE_EVALS]: "evals",
  [TABLE_MESSAGES]: "messages",
  [TABLE_THREADS]: "threads",
  [TABLE_TRACES]: "traces",
} as const;

export const convexToMastraTableNames = {
  snapshots: TABLE_WORKFLOW_SNAPSHOT,
  evals: TABLE_EVALS,
  messages: TABLE_MESSAGES,
  threads: TABLE_THREADS,
  traces: TABLE_TRACES,
} as const;

// Then derive the types from the constants
export type MastraToConvexTableMap = typeof mastraToConvexTableNames;
export type ConvexToMastraTableMap = typeof convexToMastraTableNames;

// Helper types to get table names
export type ConvexTableName<T extends TABLE_NAMES> = MastraToConvexTableMap[T];
export type MastraTableName<T extends keyof ConvexToMastraTableMap> =
  ConvexToMastraTableMap[T];

// Type that maps Mastra table names to their row types
export type MastraRowTypeMap = {
  [TABLE_WORKFLOW_SNAPSHOT]: WorkflowRow;
  [TABLE_EVALS]: EvalRow;
  [TABLE_MESSAGES]: MessageType;
  [TABLE_THREADS]: StorageThreadType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [TABLE_TRACES]: any; // Replace with proper type when available
};

export type SerializedTimestamp = number;
const vSerializedTimestamp = v.number();

export type SerializedSnapshot = Omit<
  WorkflowRow,
  "created_at" | "updated_at" | "snapshot"
> & {
  created_at: SerializedTimestamp;
  updated_at: SerializedTimestamp;
  snapshot: string;
};

export type SerializedEval = Omit<EvalRow, "createdAt"> & {
  createdAt: SerializedTimestamp;
};

export type SerializedContent = SerializeUrlsAndUint8Arrays<
  MessageType["content"]
>;

export type SerializedMessage = Omit<MessageType, "createdAt" | "content"> & {
  createdAt: SerializedTimestamp;
  content: SerializedContent;
};

export const vSerializedMessage = v.object({
  id: v.string(),
  threadId: v.string(),
  content: vContent,
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
});

export type SerializedThread = Omit<
  StorageThreadType,
  "createdAt" | "updatedAt"
> & {
  createdAt: SerializedTimestamp;
  updatedAt: SerializedTimestamp;
};
export const vSerializedThread = v.object({
  id: v.string(),
  title: v.optional(v.string()),
  metadata: v.optional(v.record(v.string(), v.any())),
  resourceId: v.string(),
  createdAt: vSerializedTimestamp,
  updatedAt: vSerializedTimestamp,
});

// Inferring from the table schema created in
// @mastra/core:src/storage/base.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export type SerializedTrace = {
  id: string;
  parentSpanId?: string | null;
  traceId: string;
  name: string;
  scope: string;
  kind: number | bigint;
  events?: any[];
  links?: any[];
  status?: any;
  attributes?: Record<string, any>;
  startTime: bigint;
  endTime: bigint;
  other?: any;
  createdAt: SerializedTimestamp;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

// Type that maps Convex table names to their document types
export type SerializedTypeMap = {
  [TABLE_WORKFLOW_SNAPSHOT]: SerializedSnapshot;
  [TABLE_EVALS]: SerializedEval;
  [TABLE_MESSAGES]: SerializedMessage;
  [TABLE_THREADS]: SerializedThread;
  [TABLE_TRACES]: SerializedTrace;
};

function serializeDate(date: string | Date | number): number {
  if (typeof date === "number") {
    return date;
  }
  if (date instanceof Date) {
    return Number(date);
  }
  return Number(new Date(date));
}

/**
 * Maps a Mastra row to a Convex document
 * @param tableName Mastra table name
 * @param mastraRow Row data from Mastra
 * @returns Properly typed Convex document
 */
export function mapMastraToSerialized<T extends TABLE_NAMES>(
  tableName: T,
  mastraRow: MastraRowTypeMap[T]
): SerializedTypeMap[T] {
  switch (tableName) {
    case TABLE_WORKFLOW_SNAPSHOT: {
      const row = mastraRow as MastraRowTypeMap[typeof TABLE_WORKFLOW_SNAPSHOT];
      const serialized: SerializedSnapshot = {
        workflow_name: row.workflow_name,
        run_id: row.run_id,
        snapshot: JSON.stringify(row.snapshot),
        updated_at: serializeDate(row.updated_at),
        created_at: serializeDate(row.created_at),
      };
      return serialized as SerializedTypeMap[T];
    }
    case TABLE_EVALS: {
      const row = mastraRow as MastraRowTypeMap[typeof TABLE_EVALS];
      const serialized: SerializedEval = {
        input: row.input,
        output: row.output,
        result: row.result,
        agentName: row.agentName,
        metricName: row.metricName,
        instructions: row.instructions,
        testInfo: row.testInfo,
        globalRunId: row.globalRunId,
        runId: row.runId,
        createdAt: serializeDate(row.createdAt),
      };
      return serialized as SerializedTypeMap[T];
    }
    case TABLE_MESSAGES: {
      const row = mastraRow as MastraRowTypeMap[typeof TABLE_MESSAGES];
      const serialized: SerializedMessage = {
        id: row.id,
        threadId: row.threadId,
        content: serializeContent(row.content),
        role: row.role,
        type: row.type,
        createdAt: serializeDate(row.createdAt),
      };
      return serialized as SerializedTypeMap[T];
    }
    case TABLE_THREADS: {
      const row = mastraRow as MastraRowTypeMap[typeof TABLE_THREADS];
      const serialized: SerializedThread = {
        id: row.id,
        title: row.title,
        metadata: row.metadata,
        resourceId: row.resourceId,
        createdAt: serializeDate(row.createdAt),
        updatedAt: serializeDate(row.updatedAt),
      };
      return serialized as SerializedTypeMap[T];
    }
    case TABLE_TRACES: {
      const row = mastraRow as MastraRowTypeMap[typeof TABLE_TRACES];
      const serialized: SerializedTrace = {
        id: row.id,
        parentSpanId: row.parentSpanId,
        name: row.name,
        traceId: row.traceId,
        scope: row.scope,
        kind: row.kind,
        attributes: row.attributes,
        status: row.status,
        events: row.events,
        links: row.links,
        other: row.other,
        startTime: row.startTime,
        endTime: row.endTime,
        createdAt: serializeDate(row.createdAt),
      };
      return serialized as SerializedTypeMap[T];
    }
    default:
      throw new Error(`Unsupported table name: ${tableName}`);
  }
}

export function serializeContent(
  content: UserContent | AssistantContent | ToolContent
): SerializedContent {
  if (typeof content === "string") {
    return content;
  }
  const serialized = content.map((part) => {
    switch (part.type) {
      case "image":
        return { ...part, image: serializeDataOrUrl(part.image) };
      case "file":
        return { ...part, file: serializeDataOrUrl(part.data) };
      default:
        return part;
    }
  });
  return serialized as SerializedContent;
}

export function deserializeContent(
  content: SerializedContent
): UserContent | AssistantContent | ToolContent {
  if (typeof content === "string") {
    return content;
  }
  return content.map((part) => {
    switch (part.type) {
      case "image":
        return { ...part, image: deserializeUrl(part.image) };
      case "file":
        return { ...part, file: deserializeUrl(part.data) };
      default:
        return part;
    }
  }) as UserContent | AssistantContent | ToolContent;
}
function serializeDataOrUrl(
  dataOrUrl: DataContent | URL
): ArrayBuffer | string {
  if (typeof dataOrUrl === "string") {
    return dataOrUrl;
  }
  if (dataOrUrl instanceof ArrayBuffer) {
    return dataOrUrl; // Already an ArrayBuffer
  }
  if (dataOrUrl instanceof URL) {
    return dataOrUrl.toString();
  }
  return dataOrUrl.buffer.slice(
    dataOrUrl.byteOffset,
    dataOrUrl.byteOffset + dataOrUrl.byteLength
  ) as ArrayBuffer;
}

function deserializeUrl(urlOrString: string | ArrayBuffer): URL | DataContent {
  if (typeof urlOrString === "string") {
    if (
      urlOrString.startsWith("http://") ||
      urlOrString.startsWith("https://")
    ) {
      return new URL(urlOrString);
    }
    return urlOrString;
  }
  return urlOrString;
}

/**
 * Maps a Convex document to a Mastra row
 * @param tableName Mastra table name
 * @param row Data with transfer-safe values
 * @returns Properly typed Mastra row
 */
export function mapSerializedToMastra<T extends TABLE_NAMES>(
  tableName: T,
  row: SerializedTypeMap[T]
): MastraRowTypeMap[T] {
  switch (tableName) {
    case TABLE_WORKFLOW_SNAPSHOT: {
      const serialized =
        row as SerializedTypeMap[typeof TABLE_WORKFLOW_SNAPSHOT];
      const workflow: WorkflowRow = {
        workflow_name: serialized.workflow_name,
        run_id: serialized.run_id,
        snapshot: JSON.parse(serialized.snapshot),
        created_at: new Date(serialized.created_at),
        updated_at: new Date(serialized.updated_at),
      };
      return workflow;
    }
    case TABLE_EVALS: {
      const serialized = row as SerializedTypeMap[typeof TABLE_EVALS];
      const evalRow: EvalRow = {
        input: serialized.input,
        output: serialized.output,
        result: serialized.result,
        agentName: serialized.agentName,
        metricName: serialized.metricName,
        instructions: serialized.instructions,
        testInfo: serialized.testInfo,
        globalRunId: serialized.globalRunId,
        runId: serialized.runId,
        createdAt: new Date(serialized.createdAt).toISOString(),
      };
      return evalRow as MastraRowTypeMap[T];
    }
    case TABLE_MESSAGES: {
      const serialized = row as SerializedTypeMap[typeof TABLE_MESSAGES];
      const messageRow: MessageType = {
        id: serialized.id,
        threadId: serialized.threadId,
        content: serialized.content,
        role: serialized.role,
        type: serialized.type,
        createdAt: new Date(serialized.createdAt),
      };
      return messageRow as MastraRowTypeMap[T];
    }
    case TABLE_THREADS: {
      const serialized = row as SerializedTypeMap[typeof TABLE_THREADS];
      const threadRow: StorageThreadType = {
        id: serialized.id,
        title: serialized.title,
        metadata: serialized.metadata,
        resourceId: serialized.resourceId,
        createdAt: new Date(serialized.createdAt),
        updatedAt: new Date(serialized.updatedAt),
      };
      return threadRow as MastraRowTypeMap[T];
    }
    case TABLE_TRACES: {
      const traceDoc = row as SerializedTypeMap[typeof TABLE_TRACES];
      return {
        id: traceDoc.id,
        parentSpanId: traceDoc.parentSpanId,
        name: traceDoc.name,
        traceId: traceDoc.traceId,
        scope: traceDoc.scope,
        kind: traceDoc.kind,
        attributes: traceDoc.attributes,
        status: traceDoc.status,
        events: traceDoc.events,
        links: traceDoc.links,
        other: traceDoc.other,
        startTime: traceDoc.startTime,
        endTime: traceDoc.endTime,
      } as MastraRowTypeMap[T];
    }
    default:
      throw new Error(`Unsupported table name: ${tableName}`);
  }
}
