/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as debug from "../debug.js";
import type * as logger from "../logger.js";
import type * as machine from "../machine.js";
import type * as storage_messages from "../storage/messages.js";
import type * as storage_storage from "../storage/storage.js";
import type * as storage_tables from "../storage/tables.js";
import type * as vector_tables from "../vector/tables.js";
import type * as vector_vector from "../vector/vector.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  debug: typeof debug;
  logger: typeof logger;
  machine: typeof machine;
  "storage/messages": typeof storage_messages;
  "storage/storage": typeof storage_storage;
  "storage/tables": typeof storage_tables;
  "vector/tables": typeof vector_tables;
  "vector/vector": typeof vector_vector;
}>;
export type Mounts = {
  machine: {
    create: FunctionReference<
      "mutation",
      "public",
      {
        fnName: string;
        logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
        name: string;
      },
      any
    >;
    run: FunctionReference<
      "mutation",
      "public",
      { input: any; machineId: string },
      any
    >;
    status: FunctionReference<"query", "public", { machineId: string }, any>;
  };
  storage: {
    messages: {
      deleteThread: FunctionReference<
        "mutation",
        "public",
        { threadId: string },
        null
      >;
      getMessagesPage: FunctionReference<
        "query",
        "public",
        {
          selectBy?: {
            include?: Array<{
              id: string;
              withNextMessages?: number;
              withPreviousMessages?: number;
            }>;
            last?: number | false;
            vectorSearchString?: string;
          };
          threadId: string;
        },
        Array<{
          content:
            | string
            | Array<
                | {
                    experimental_providerMetadata?: Record<
                      string,
                      Record<string, any>
                    >;
                    providerOptions?: Record<string, Record<string, any>>;
                    text: string;
                    type: "text";
                  }
                | {
                    experimental_providerMetadata?: Record<
                      string,
                      Record<string, any>
                    >;
                    image: string | ArrayBuffer;
                    mimeType?: string;
                    providerOptions?: Record<string, Record<string, any>>;
                    type: "image";
                  }
                | {
                    data: string | ArrayBuffer;
                    experimental_providerMetadata?: Record<
                      string,
                      Record<string, any>
                    >;
                    mimeType: string;
                    providerOptions?: Record<string, Record<string, any>>;
                    type: "file";
                  }
              >
            | string
            | Array<
                | {
                    experimental_providerMetadata?: Record<
                      string,
                      Record<string, any>
                    >;
                    providerOptions?: Record<string, Record<string, any>>;
                    text: string;
                    type: "text";
                  }
                | {
                    data: string | ArrayBuffer;
                    experimental_providerMetadata?: Record<
                      string,
                      Record<string, any>
                    >;
                    mimeType: string;
                    providerOptions?: Record<string, Record<string, any>>;
                    type: "file";
                  }
                | {
                    experimental_providerMetadata?: Record<
                      string,
                      Record<string, any>
                    >;
                    providerOptions?: Record<string, Record<string, any>>;
                    text: string;
                    type: "reasoning";
                  }
                | {
                    data: string;
                    experimental_providerMetadata?: Record<
                      string,
                      Record<string, any>
                    >;
                    providerOptions?: Record<string, Record<string, any>>;
                    type: "redacted-reasoning";
                  }
                | {
                    args: any;
                    experimental_providerMetadata?: Record<
                      string,
                      Record<string, any>
                    >;
                    providerOptions?: Record<string, Record<string, any>>;
                    toolCallId: string;
                    toolName: string;
                    type: "tool-call";
                  }
              >
            | Array<{
                experimental_content?: Array<
                  | { text: string; type: "text" }
                  | { data: string; mimeType?: string; type: "image" }
                >;
                experimental_providerMetadata?: Record<
                  string,
                  Record<string, any>
                >;
                isError?: boolean;
                providerOptions?: Record<string, Record<string, any>>;
                result: any;
                toolCallId: string;
                toolName: string;
                type: "tool-result";
              }>;
          createdAt: number;
          id: string;
          role: "system" | "user" | "assistant" | "tool";
          threadId: string;
          type: "text" | "tool-call" | "tool-result";
        }>
      >;
      getThreadById: FunctionReference<
        "query",
        "public",
        { threadId: string },
        {
          createdAt: number;
          id: string;
          metadata?: Record<string, any>;
          resourceId: string;
          title?: string;
          updatedAt: number;
        } | null
      >;
      getThreadsByResourceId: FunctionReference<
        "query",
        "public",
        { cursor?: string | null; resourceId: string },
        {
          continueCursor: string;
          isDone: boolean;
          threads: Array<{
            createdAt: number;
            id: string;
            metadata?: Record<string, any>;
            resourceId: string;
            title?: string;
            updatedAt: number;
          }>;
        }
      >;
      saveMessages: FunctionReference<
        "mutation",
        "public",
        {
          messages: Array<{
            content:
              | string
              | Array<
                  | {
                      experimental_providerMetadata?: Record<
                        string,
                        Record<string, any>
                      >;
                      providerOptions?: Record<string, Record<string, any>>;
                      text: string;
                      type: "text";
                    }
                  | {
                      experimental_providerMetadata?: Record<
                        string,
                        Record<string, any>
                      >;
                      image: string | ArrayBuffer;
                      mimeType?: string;
                      providerOptions?: Record<string, Record<string, any>>;
                      type: "image";
                    }
                  | {
                      data: string | ArrayBuffer;
                      experimental_providerMetadata?: Record<
                        string,
                        Record<string, any>
                      >;
                      mimeType: string;
                      providerOptions?: Record<string, Record<string, any>>;
                      type: "file";
                    }
                >
              | string
              | Array<
                  | {
                      experimental_providerMetadata?: Record<
                        string,
                        Record<string, any>
                      >;
                      providerOptions?: Record<string, Record<string, any>>;
                      text: string;
                      type: "text";
                    }
                  | {
                      data: string | ArrayBuffer;
                      experimental_providerMetadata?: Record<
                        string,
                        Record<string, any>
                      >;
                      mimeType: string;
                      providerOptions?: Record<string, Record<string, any>>;
                      type: "file";
                    }
                  | {
                      experimental_providerMetadata?: Record<
                        string,
                        Record<string, any>
                      >;
                      providerOptions?: Record<string, Record<string, any>>;
                      text: string;
                      type: "reasoning";
                    }
                  | {
                      data: string;
                      experimental_providerMetadata?: Record<
                        string,
                        Record<string, any>
                      >;
                      providerOptions?: Record<string, Record<string, any>>;
                      type: "redacted-reasoning";
                    }
                  | {
                      args: any;
                      experimental_providerMetadata?: Record<
                        string,
                        Record<string, any>
                      >;
                      providerOptions?: Record<string, Record<string, any>>;
                      toolCallId: string;
                      toolName: string;
                      type: "tool-call";
                    }
                >
              | Array<{
                  experimental_content?: Array<
                    | { text: string; type: "text" }
                    | { data: string; mimeType?: string; type: "image" }
                  >;
                  experimental_providerMetadata?: Record<
                    string,
                    Record<string, any>
                  >;
                  isError?: boolean;
                  providerOptions?: Record<string, Record<string, any>>;
                  result: any;
                  toolCallId: string;
                  toolName: string;
                  type: "tool-result";
                }>;
            createdAt: number;
            id: string;
            role: "system" | "user" | "assistant" | "tool";
            threadId: string;
            type: "text" | "tool-call" | "tool-result";
          }>;
        },
        null
      >;
      saveThread: FunctionReference<
        "mutation",
        "public",
        {
          thread: {
            createdAt: number;
            id: string;
            metadata?: Record<string, any>;
            resourceId: string;
            title?: string;
            updatedAt: number;
          };
        },
        null
      >;
      updateThread: FunctionReference<
        "mutation",
        "public",
        { metadata?: Record<string, any>; threadId: string; title?: string },
        {
          createdAt: number;
          id: string;
          metadata?: Record<string, any>;
          resourceId: string;
          title?: string;
          updatedAt: number;
        }
      >;
    };
    storage: {
      batchInsert: FunctionReference<
        "mutation",
        "public",
        { records: Array<any>; tableName: string },
        null
      >;
      clearTable: FunctionReference<
        "action",
        "public",
        { tableName: string },
        null
      >;
      getEvalsByAgentName: FunctionReference<
        "query",
        "public",
        { agentName: string; type?: "test" | "live" },
        Array<{
          agentName: string;
          createdAt: number;
          globalRunId: string;
          input: string;
          instructions: string;
          metricName: string;
          output: string;
          result: any;
          runId: string;
          testInfo?: any;
        }>
      >;
      getTracesPage: FunctionReference<
        "query",
        "public",
        {
          attributes?: Record<string, string>;
          cursor: string | null;
          name?: string;
          numItems: number;
          scope?: string;
        },
        {
          continuCursor: string;
          isDone: boolean;
          page: Array<{
            attributes?: any;
            createdAt: number;
            endTime: bigint;
            events?: any;
            id: string;
            kind: number | bigint;
            links?: any;
            name: string;
            other?: string;
            parentSpanId?: string | null;
            scope: string;
            startTime: bigint;
            status?: any;
            traceId: string;
          }>;
        }
      >;
      insert: FunctionReference<
        "mutation",
        "public",
        { document: any; tableName: string },
        null
      >;
      load: FunctionReference<
        "query",
        "public",
        { keys: any; tableName: string },
        any | null
      >;
    };
  };
  vector: {
    vector: {
      createIndex: FunctionReference<
        "mutation",
        "public",
        {
          dimensions: 128 | 256 | 512 | 768 | 1024 | 1536 | 2048 | 3072 | 4096;
          indexName: string;
        },
        any
      >;
      deleteIndex: FunctionReference<
        "action",
        "public",
        { indexName: string },
        any
      >;
      describeIndex: FunctionReference<
        "query",
        "public",
        { indexName: string },
        any
      >;
      listIndexes: FunctionReference<"query", "public", {}, any>;
      search: FunctionReference<
        "action",
        "public",
        {
          filter?: Record<string, any>;
          includeVector?: boolean;
          indexName: string;
          queryVector: Array<number>;
          topK: number;
        },
        any
      >;
      upsert: FunctionReference<
        "mutation",
        "public",
        {
          ids?: Array<string>;
          indexName: string;
          metadata?: Array<Record<string, any>>;
          vectors: Array<Array<number>>;
        },
        Array<string>
      >;
    };
  };
};
// For now fullApiWithMounts is only fullApi which provides
// jump-to-definition in component client code.
// Use Mounts for the same type without the inference.
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
