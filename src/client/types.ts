/* Type utils follow */

import {
  Expand,
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  GenericActionCtx,
} from "convex/server";

import { GenericMutationCtx } from "convex/server";

import { GenericQueryCtx } from "convex/server";

import { GenericDataModel } from "convex/server";
import { GenericId } from "convex/values";

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
      args: FunctionArgs<Query>
    ) => Promise<FunctionReturnType<Query>>;
    runMutation: <Mutation extends FunctionReference<"mutation", "internal">>(
      mutation: Mutation,
      args: FunctionArgs<Mutation>
    ) => Promise<FunctionReturnType<Mutation>>;
    runAction: <Action extends FunctionReference<"action", "internal">>(
      action: Action,
      args: FunctionArgs<Action>
    ) => Promise<FunctionReturnType<Action>>;
  },
  T
>;

type QueryCtx = CtxWith<"runQuery">;
const queryCtx = {} as QueryCtx;
