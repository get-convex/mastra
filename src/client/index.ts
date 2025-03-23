import {
  createFunctionHandle,
  FunctionReference,
  getFunctionName,
} from "convex/server";
import type { api } from "../component/_generated/api";
import { OpaqueIds, RunMutationCtx, RunQueryCtx, UseApi } from "./types";
import { DEFAULT_LOG_LEVEL, LogLevel } from "../component/logger";
import type { ActionArgs } from "./registry";
import { StepStatus } from "../component/workflow/types";

export class WorkflowRunner {
  logLevel: LogLevel;
  constructor(
    public component: UseApi<typeof api>,
    public options?: { logLevel?: LogLevel }
  ) {
    this.logLevel = options?.logLevel ?? DEFAULT_LOG_LEVEL;
  }
  async create(
    ctx: RunMutationCtx,
    fn: FunctionReference<"action", "internal">
  ) {
    const fnHandle = await createFunctionHandle<"action", ActionArgs, null>(fn);
    const runId = await ctx.runMutation(this.component.workflow.index.create, {
      logLevel: this.logLevel,
      workflow: {
        fnHandle,
        fnName: getFunctionName(fn),
      },
    });
    return {
      runId,
      start: this.start.bind(this, ctx, runId),
      startAsync: this.startAsync.bind(this, ctx, runId),
      resume: this.resume.bind(this, ctx, runId),
    };
  }
  async startAsync(ctx: RunMutationCtx, runId: string, initialData: unknown) {
    await ctx.runMutation(this.component.workflow.index.start, {
      workflowId: runId,
      initialData,
    });
  }
  async start(ctx: RunMutationCtx, runId: string, initialData: unknown) {
    await this.startAsync(ctx, runId, initialData);
    return await this.waitForResult(ctx, runId);
  }
  async resume(
    ctx: RunMutationCtx,
    runId: string,
    resumeArgs: { stepId: string; context: unknown }
  ) {
    await ctx.runMutation(this.component.workflow.index.resume, {
      workflowId: runId,
      stepId: resumeArgs.stepId,
      resumeData: resumeArgs.context,
    });
  }
  async waitForResult(ctx: RunQueryCtx, runId: string) {
    console.debug("Polling from client", runId);
    while (true) {
      const status = await this.getStatus(ctx, runId);
      if (!status) {
        return null;
      }
      // TODO: should this return if it's suspended?
      if (["completed", "failed"].includes(status.status)) {
        return status;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  async getStatus(ctx: RunQueryCtx, runId: string) {
    const status = await ctx.runQuery(this.component.workflow.index.status, {
      workflowId: runId,
    });
    if (!status) {
      return null;
    }
    return {
      status: status.status,
      stepStates: status.stepStates?.reduce(
        (acc, stepState) => {
          if (stepState) {
            acc[stepState.stepId] = stepState.status;
          }
          return acc;
        },
        {} as Record<string, OpaqueIds<StepStatus>>
      ),
    };
  }
}
