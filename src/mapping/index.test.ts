import type {
  EvalRow,
  TABLE_NAMES as ORIGINAL_TABLE_NAMES,
} from "@mastra/core/storage";
import { expect, test } from "vitest";
import { Content } from "../ai/types";
import {
  TABLE_NAMES as NEW_TABLE_NAMES,
  SerializedContent,
  SerializedMessage,
  SerializedThread,
  vSerializedMessage,
  vSerializedThread,
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_EVALS,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_TRACES,
  mapMastraToSerialized,
  mapSerializedToMastra,
  serializeContent,
  deserializeContent,
} from "./index.js";
import assert from "assert";
import { TestInfo } from "@mastra/core";

// Type compatibility tests
const _tableNames: ORIGINAL_TABLE_NAMES = "" as NEW_TABLE_NAMES;
const _tableNames2: NEW_TABLE_NAMES = "" as ORIGINAL_TABLE_NAMES;
const _content: SerializedContent = [] as Content;
const _content2: Content = [] as SerializedContent;

test("table name mappings are bijective", () => {
  expect(TABLE_WORKFLOW_SNAPSHOT).toBe("mastra_workflow_snapshot");
  expect(TABLE_EVALS).toBe("mastra_evals");
  expect(TABLE_MESSAGES).toBe("mastra_messages");
  expect(TABLE_THREADS).toBe("mastra_threads");
  expect(TABLE_TRACES).toBe("mastra_traces");
});

test("workflow snapshot mapping", () => {
  const now = new Date();
  const mastraRow = {
    workflow_name: "test_workflow",
    run_id: "run123",
    snapshot: {
      state: "RUNNING",
      value: { test: "test" },
      context: {
        steps: {},
        triggerData: {},
        attempts: {},
      },
      activePaths: [],
      runId: "run123",
      timestamp: now.getTime(),
    },
    created_at: now,
    updated_at: now,
  };

  const serialized = mapMastraToSerialized(TABLE_WORKFLOW_SNAPSHOT, mastraRow);
  expect(serialized.workflowName).toBe(mastraRow.workflow_name);
  expect(serialized.runId).toBe(mastraRow.run_id);
  expect(serialized.snapshot).toBe(JSON.stringify(mastraRow.snapshot));
  expect(serialized.createdAt).toBe(Number(now));
  expect(serialized.updatedAt).toBe(Number(now));

  const roundTripped = mapSerializedToMastra(
    TABLE_WORKFLOW_SNAPSHOT,
    serialized
  );
  expect(roundTripped.workflow_name).toBe(mastraRow.workflow_name);
  expect(roundTripped.run_id).toBe(mastraRow.run_id);
  expect(roundTripped.snapshot).toEqual(mastraRow.snapshot);
  expect(roundTripped.created_at.getTime()).toBe(now.getTime());
  expect(roundTripped.updated_at.getTime()).toBe(now.getTime());
});

test("eval row mapping", () => {
  const now = new Date();
  const mastraRow: EvalRow = {
    input: "test input",
    output: "test output",
    result: { score: 1 },
    agentName: "test_agent",
    metricName: "accuracy",
    instructions: "test instructions",
    testInfo: {},
    globalRunId: "global123",
    runId: "run123",
    createdAt: now.toISOString(),
  };

  const serialized = mapMastraToSerialized(TABLE_EVALS, mastraRow);
  expect(serialized.input).toBe(mastraRow.input);
  expect(serialized.output).toBe(mastraRow.output);
  expect(serialized.result).toBe(mastraRow.result);
  expect(serialized.createdAt).toBe(Number(now));

  const roundTripped = mapSerializedToMastra(TABLE_EVALS, serialized);
  expect(roundTripped.input).toBe(mastraRow.input);
  expect(roundTripped.output).toBe(mastraRow.output);
  expect(roundTripped.result).toBe(mastraRow.result);
  expect(roundTripped.createdAt).toBe(mastraRow.createdAt);
});

test("message mapping", () => {
  const now = new Date();
  const mastraRow = {
    id: "msg123",
    threadId: "thread123",
    content: "test message",
    role: "user" as const,
    type: "text" as const,
    createdAt: now,
  };

  const serialized = mapMastraToSerialized(TABLE_MESSAGES, mastraRow);
  expect(serialized.id).toBe(mastraRow.id);
  expect(serialized.threadId).toBe(mastraRow.threadId);
  expect(serialized.content).toBe(mastraRow.content);
  expect(serialized.role).toBe(mastraRow.role);
  expect(serialized.type).toBe(mastraRow.type);
  expect(serialized.createdAt).toBe(Number(now));

  const roundTripped = mapSerializedToMastra(TABLE_MESSAGES, serialized);
  expect(roundTripped.id).toBe(mastraRow.id);
  expect(roundTripped.threadId).toBe(mastraRow.threadId);
  expect(roundTripped.content).toBe(mastraRow.content);
  expect(roundTripped.role).toBe(mastraRow.role);
  expect(roundTripped.type).toBe(mastraRow.type);
  expect(roundTripped.createdAt.getTime()).toBe(now.getTime());
});

test("thread mapping", () => {
  const now = new Date();
  const mastraRow = {
    id: "thread123",
    title: "Test Thread",
    metadata: { key: "value" },
    resourceId: "resource123",
    createdAt: now,
    updatedAt: now,
  };

  const serialized = mapMastraToSerialized(TABLE_THREADS, mastraRow);
  expect(serialized.id).toBe(mastraRow.id);
  expect(serialized.title).toBe(mastraRow.title);
  expect(serialized.metadata).toEqual(mastraRow.metadata);
  expect(serialized.resourceId).toBe(mastraRow.resourceId);
  expect(serialized.createdAt).toBe(Number(now));
  expect(serialized.updatedAt).toBe(Number(now));

  const roundTripped = mapSerializedToMastra(TABLE_THREADS, serialized);
  expect(roundTripped.id).toBe(mastraRow.id);
  expect(roundTripped.title).toBe(mastraRow.title);
  expect(roundTripped.metadata).toEqual(mastraRow.metadata);
  expect(roundTripped.resourceId).toBe(mastraRow.resourceId);
  expect(roundTripped.createdAt.getTime()).toBe(now.getTime());
  expect(roundTripped.updatedAt.getTime()).toBe(now.getTime());
});

test("trace mapping", () => {
  const now = new Date();
  const mastraRow = {
    id: "trace123",
    parentSpanId: "parent123",
    traceId: "trace123",
    name: "test_trace",
    scope: "test",
    kind: 1n,
    startTime: 1000n,
    endTime: 2000n,
    createdAt: now,
  };

  const serialized = mapMastraToSerialized(TABLE_TRACES, mastraRow);
  expect(serialized.id).toBe(mastraRow.id);
  expect(serialized.parentSpanId).toBe(mastraRow.parentSpanId);
  expect(serialized.traceId).toBe(mastraRow.traceId);
  expect(serialized.name).toBe(mastraRow.name);
  expect(serialized.scope).toBe(mastraRow.scope);
  expect(serialized.kind).toBe(mastraRow.kind);
  expect(serialized.startTime).toBe(mastraRow.startTime);
  expect(serialized.endTime).toBe(mastraRow.endTime);
  expect(serialized.createdAt).toBe(Number(now));

  const roundTripped = mapSerializedToMastra(TABLE_TRACES, serialized);
  expect(roundTripped.id).toBe(mastraRow.id);
  expect(roundTripped.parentSpanId).toBe(mastraRow.parentSpanId);
  expect(roundTripped.traceId).toBe(mastraRow.traceId);
  expect(roundTripped.name).toBe(mastraRow.name);
  expect(roundTripped.scope).toBe(mastraRow.scope);
  expect(roundTripped.kind).toBe(mastraRow.kind);
  expect(roundTripped.startTime).toBe(mastraRow.startTime);
  expect(roundTripped.endTime).toBe(mastraRow.endTime);
});

test("content serialization with URLs", () => {
  const url = new URL("https://example.com/image.jpg");
  const content = [
    { type: "image" as const, image: url },
    { type: "text" as const, text: "test" },
  ];

  const serialized = serializeContent(content);
  assert(serialized[0] instanceof Object);
  assert(serialized[0].type === "image");
  expect(serialized[0].image).toBe(url.toString());
  expect(serialized[1]).toEqual(content[1]);

  const deserialized = deserializeContent(serialized);
  assert(deserialized[0] instanceof Object);
  assert(deserialized[0].type === "image");
  expect(deserialized[0].image).toBeInstanceOf(URL);
  expect((deserialized[0].image as URL).toString()).toBe(url.toString());
  expect(deserialized[1]).toEqual(content[1]);
});

test("content serialization with ArrayBuffer", () => {
  const buffer = new ArrayBuffer(8);
  const content = [
    {
      type: "file" as const,
      data: buffer,
      mimeType: "application/octet-stream",
    },
    { type: "text" as const, text: "test" },
  ];

  const serialized = serializeContent(content);
  assert(serialized[0] instanceof Object);
  assert(serialized[0].type === "file");
  expect(serialized[0].data).toBeInstanceOf(ArrayBuffer);
  expect(serialized[1]).toEqual(content[1]);

  const deserialized = deserializeContent(serialized);
  assert(deserialized[0] instanceof Object);
  assert(deserialized[0].type === "file");
  expect(deserialized[0].data).toBeInstanceOf(ArrayBuffer);
  expect(deserialized[1]).toEqual(content[1]);
});

test("invalid table name throws error", () => {
  expect(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapMastraToSerialized("invalid_table" as any, {})
  ).toThrow("Unsupported table name: invalid_table");

  expect(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapSerializedToMastra("invalid_table" as any, {})
  ).toThrow("Unsupported table name: invalid_table");
});
