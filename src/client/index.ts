import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import type { api } from "../component/_generated/api";
import { RunMutationCtx, RunQueryCtx, UseApi } from "./types";

export class Mastra<Shards extends Record<string, number>> {
  constructor(
    public component: UseApi<typeof api>,
    public options?: { shards?: Shards; defaultShards?: number }
  ) {}
}
