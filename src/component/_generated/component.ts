/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    storage: {
      messages: {
        deleteThread: FunctionReference<
          "mutation",
          "internal",
          { threadId: string },
          null,
          Name
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
            resourceId: string;
            role: "system" | "user" | "assistant" | "tool";
            threadId: string;
            type: "text" | "tool-call" | "tool-result";
          }>,
          Name
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
          } | null,
          Name
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
          },
          Name
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
              resourceId: string;
              role: "system" | "user" | "assistant" | "tool";
              threadId: string;
              type: "text" | "tool-call" | "tool-result";
            }>;
          },
          null,
          Name
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
          null,
          Name
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
          },
          Name
        >;
      };
      storage: {
        batchInsert: FunctionReference<
          "mutation",
          "internal",
          { records: Array<any>; tableName: string },
          null,
          Name
        >;
        clearTable: FunctionReference<
          "action",
          "internal",
          { tableName: string },
          null,
          Name
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
          }>,
          Name
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
          },
          Name
        >;
        insert: FunctionReference<
          "mutation",
          "internal",
          { document: any; tableName: string },
          null,
          Name
        >;
        load: FunctionReference<
          "query",
          "internal",
          { keys: any; tableName: string },
          any | null,
          Name
        >;
        loadSnapshot: FunctionReference<
          "query",
          "internal",
          { runId: string; workflowName: string },
          {
            createdAt: number;
            runId: string;
            snapshot: string;
            updatedAt: number;
            workflowName: string;
          } | null,
          Name
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
          null,
          Name
        >;
        deleteIndex: FunctionReference<
          "action",
          "internal",
          { indexName: string },
          null,
          Name
        >;
        describeIndex: FunctionReference<
          "query",
          "internal",
          { indexName: string },
          {
            count: number;
            dimension: 128 | 256 | 512 | 768 | 1024 | 1536 | 2048 | 3072 | 4096;
            metric: "cosine";
          },
          Name
        >;
        listIndexes: FunctionReference<
          "query",
          "internal",
          {},
          Array<string>,
          Name
        >;
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
          Array<{
            id: string;
            metadata?: Record<string, any>;
            score: number;
            vector?: Array<number>;
          }>,
          Name
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
          Array<string>,
          Name
        >;
      };
    };
  };
