import type { TABLE_NAMES as ORIGINAL_TABLE_NAMES } from "@mastra/core/storage";
import type {
  TABLE_NAMES as NEW_TABLE_NAMES,
  SerializedContent,
  SerializedMessage,
  SerializedThread,
  vSerializedMessage,
  vSerializedThread,
} from "./storage";
import { Infer } from "convex/values";
import { Content } from "../ai/types";

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
