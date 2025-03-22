import {
  createFunctionHandle,
  FunctionReference,
  GenericActionCtx,
  GenericDataModel,
  getFunctionName,
} from "convex/server";
import type { api } from "../component/_generated/api";
import { UseApi } from "./types";
import { LogLevel } from "../component/logger";
import { ActionArgs } from "./registry";

export class WorkflowRunner {
  constructor(
    public component: UseApi<typeof api>,
    public options?: { logLevel?: LogLevel }
  ) {}
  async create(
    ctx: GenericActionCtx<GenericDataModel>,
    fn: FunctionReference<"action", "internal">
  ) {
    const fnHandle = await createFunctionHandle<"action", ActionArgs, null>(fn);
    const runId = await ctx.runAction(fn, {
      op: {
        kind: "create",
        fnHandle,
        fnName: getFunctionName(fn),
      },
    });
    return {
      runId,
      start: this.start.bind(this, ctx, runId),
      resume: this.resume.bind(this, ctx, runId),
    };
  }
  async startAsync(
    ctx: GenericActionCtx<GenericDataModel>,
    runId: string,
    initialData: unknown
  ) {
    await ctx.runMutation(this.component.machine.run, {
      machineId: runId,
      input: { initialData },
    });
  }
  async start(
    ctx: GenericActionCtx<GenericDataModel>,
    runId: string,
    initialData: unknown
  ) {
    await this.startAsync(ctx, runId, initialData);
    return await this.waitForCompletion(ctx, runId);
  }
  async resume(
    ctx: GenericActionCtx<GenericDataModel>,
    runId: string,
    resumeData: unknown
  ) {
    await ctx.runMutation(this.component.machine.run, {
      machineId: runId,
      input: { resumeData },
    });
  }
  async waitForCompletion(
    ctx: GenericActionCtx<GenericDataModel>,
    runId: string
  ) {
    console.debug("Polling from client", runId);
    while (true) {
      const status = await ctx.runQuery(this.component.machine.status, {
        machineId: runId,
      });
      const completed = !!status; // TODO: check status
      if (completed) {
        return status.name; // TODO: return output
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
