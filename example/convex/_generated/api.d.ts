/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _libsql_workaround from "../_libsql_workaround.js";
import type * as example from "../example.js";
import type * as nodeRuntime from "../nodeRuntime.js";
import type * as v8Runtime from "../v8Runtime.js";

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
  _libsql_workaround: typeof _libsql_workaround;
  example: typeof example;
  nodeRuntime: typeof nodeRuntime;
  v8Runtime: typeof v8Runtime;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {
  mastra: {
    storage: {
      messages: {
        deleteThread: FunctionReference<
          "mutation",
          "internal",
          { threadId: string },
          null
        >;
        getMessagesPage: FunctionReference<
          "query",
          "internal",
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
          "internal",
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
          "internal",
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
          "internal",
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
          "internal",
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
          "internal",
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
          "internal",
          { records: Array<any>; tableName: string },
          null
        >;
        clearTable: FunctionReference<
          "action",
          "internal",
          { tableName: string },
          null
        >;
        getEvalsByAgentName: FunctionReference<
          "query",
          "internal",
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
          "internal",
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
          "internal",
          { document: any; tableName: string },
          null
        >;
        load: FunctionReference<
          "query",
          "internal",
          { keys: any; tableName: string },
          any | null
        >;
        loadSnapshot: FunctionReference<
          "query",
          "internal",
          { runId: string; workflowName: string },
          any
        >;
      };
    };
    vector: {
      vector: {
        createIndex: FunctionReference<
          "mutation",
          "internal",
          {
            dimensions:
              | 128
              | 256
              | 512
              | 768
              | 1024
              | 1536
              | 2048
              | 3072
              | 4096;
            indexName: string;
          },
          any
        >;
        deleteIndex: FunctionReference<
          "action",
          "internal",
          { indexName: string },
          any
        >;
        describeIndex: FunctionReference<
          "query",
          "internal",
          { indexName: string },
          any
        >;
        listIndexes: FunctionReference<"query", "internal", {}, any>;
        search: FunctionReference<
          "action",
          "internal",
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
          "internal",
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
    workflow: {
      index: {
        create: FunctionReference<
          "mutation",
          "internal",
          {
            logLevel: "DEBUG" | "TRACE" | "INFO" | "REPORT" | "WARN" | "ERROR";
            workflow: { fnHandle: string; fnName: string };
            workpoolLogLevel:
              | "DEBUG"
              | "TRACE"
              | "INFO"
              | "REPORT"
              | "WARN"
              | "ERROR";
          },
          any
        >;
        resume: FunctionReference<
          "mutation",
          "internal",
          { resumeData?: any; stepId: string; workflowId: string },
          any
        >;
        start: FunctionReference<
          "mutation",
          "internal",
          { triggerData?: any; workflowId: string },
          any
        >;
        status: FunctionReference<
          "query",
          "internal",
          { workflowId: string },
          any
        >;
      };
    };
  };
};
