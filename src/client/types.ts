/* Type utils follow */

import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  GenericActionCtx,
} from "convex/server";

import type { GenericMutationCtx } from "convex/server";

import type { GenericQueryCtx } from "convex/server";

import type { GenericDataModel } from "convex/server";

export type RunQueryCtx = {
  runQuery: GenericQueryCtx<GenericDataModel>["runQuery"];
};
export type RunMutationCtx = {
  runQuery: GenericMutationCtx<GenericDataModel>["runQuery"];
  runMutation: GenericMutationCtx<GenericDataModel>["runMutation"];
};
export type RunActionCtx = {
  runQuery: GenericActionCtx<GenericDataModel>["runQuery"];
  runMutation: GenericActionCtx<GenericDataModel>["runMutation"];
  runAction: GenericActionCtx<GenericDataModel>["runAction"];
};

type CtxWith<T extends "runQuery" | "runMutation" | "runAction"> = Pick<
  {
    runQuery: <Query extends FunctionReference<"query", "internal">>(
      query: Query,
      args: FunctionArgs<Query>,
    ) => Promise<FunctionReturnType<Query>>;
    runMutation: <Mutation extends FunctionReference<"mutation", "internal">>(
      mutation: Mutation,
      args: FunctionArgs<Mutation>,
    ) => Promise<FunctionReturnType<Mutation>>;
    runAction: <Action extends FunctionReference<"action", "internal">>(
      action: Action,
      args: FunctionArgs<Action>,
    ) => Promise<FunctionReturnType<Action>>;
  },
  T
>;

type QueryCtx = CtxWith<"runQuery">;
const queryCtx = {} as QueryCtx;
