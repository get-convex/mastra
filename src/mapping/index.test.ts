import type { TABLE_NAMES as ORIGINAL_TABLE_NAMES } from "@mastra/core/storage";
import { convexTest } from "convex-test";
import { Infer, v } from "convex/values";
import { expect, test } from "vitest";
import { Content } from "../ai/types";
import { api, internal } from "../component/_generated/api";
import { Doc, Id } from "../component/_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../component/_generated/server";

import schema from "../component/schema";

import type {
  TABLE_NAMES as NEW_TABLE_NAMES,
  SerializedContent,
  SerializedMessage,
  SerializedThread,
  vSerializedMessage,
  vSerializedThread,
} from ".";

// type assertsions
const _tableNames: ORIGINAL_TABLE_NAMES = "" as NEW_TABLE_NAMES;
const _tableNames2: NEW_TABLE_NAMES = "" as ORIGINAL_TABLE_NAMES;

const _content: SerializedContent = [] as Content;
const _content2: Content = [] as SerializedContent;

// type assertions both ways
const _serializedMessage: SerializedMessage = {} as Infer<
  typeof vSerializedMessage
>;
const _serializedMessage2: Infer<typeof vSerializedMessage> =
  {} as SerializedMessage;

// type assertions both ways
const _serializedThread: SerializedThread = {} as Infer<
  typeof vSerializedThread
>;
const _serializedThread2: Infer<typeof vSerializedThread> =
  {} as SerializedThread;

test("test", async () => {
  const t = convexTest(schema);
});
