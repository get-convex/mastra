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
  "storage/messages": typeof storage_messages;
  "storage/storage": typeof storage_storage;
  "storage/tables": typeof storage_tables;
  "vector/tables": typeof vector_tables;
  "vector/vector": typeof vector_vector;
}>;

export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
