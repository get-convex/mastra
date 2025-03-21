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
import { createLogger } from "../component/logger";

export class WorkflowRunner {
  logLevel: LogLevel;
  constructor(
    public component: UseApi<typeof api>,
    public options?: { logLevel?: LogLevel }
  ) {
    this.logLevel = options?.logLevel ?? "DEBUG";
  }
  async create(
    ctx: GenericActionCtx<GenericDataModel>,
    fn: FunctionReference<"action", "internal">
  ) {
    const console = createLogger(this.options?.logLevel ?? "DEBUG");
    console.debug("Creating machine from client", getFunctionName(fn));
    const fnHandle = await createFunctionHandle(fn);
    const runId = await ctx.runAction(fn, {
      op: { kind: "create", fnHandle, fnName: getFunctionName(fn) },
    });
    return {
      runId,
      start: this.start.bind(this, ctx, runId),
      resume: this.resume.bind(this, ctx, runId),
    };
  }
  async start(
    ctx: GenericActionCtx<GenericDataModel>,
    runId: string,
    initialData: unknown
  ) {
    const console = createLogger(this.logLevel);
    console.debug("Starting machine from client", runId, initialData);
    await ctx.runMutation(this.component.machine.run, {
      machineId: runId,
      input: { initialData },
      logLevel: this.logLevel,
    });
  }
  async resume(
    ctx: GenericActionCtx<GenericDataModel>,
    runId: string,
    resumeData: unknown
  ) {
    const console = createLogger(this.logLevel);
    console.debug("Resuming machine from client", runId, resumeData);
    await ctx.runMutation(this.component.machine.run, {
      machineId: runId,
      input: { resumeData },
      logLevel: this.logLevel,
    });
  }
  async execute(ctx: GenericActionCtx<GenericDataModel>, runId: string) {
    const console = createLogger(this.logLevel);
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const console = "THIS IS A REMINDER TO USE createLogger";
