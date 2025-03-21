/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as lib from "../lib.js";
import type * as state_machine from "../state_machine.js";
import type * as storage_index from "../storage/index.js";
import type * as storage_messages from "../storage/messages.js";
import type * as storage_tables from "../storage/tables.js";

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
  lib: typeof lib;
  state_machine: typeof state_machine;
  "storage/index": typeof storage_index;
  "storage/messages": typeof storage_messages;
  "storage/tables": typeof storage_tables;
}>;
export type Mounts = {
  lib: {
    add: FunctionReference<
      "mutation",
      "public",
      { count: number; name: string; shards?: number },
      null
    >;
    count: FunctionReference<"query", "public", { name: string }, number>;
  };
  state_machine: {
    create: FunctionReference<"mutation", "public", { name: string }, any>;
    run: FunctionReference<
      "mutation",
      "public",
      { input: {}; machineId: string },
      any
    >;
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
