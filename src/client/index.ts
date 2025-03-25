import {
  createFunctionHandle,
  FunctionReference,
  getFunctionName,
} from "convex/server";
import type { api } from "../component/_generated/api";
import {
  OpaqueIds,
  RunActionCtx,
  RunMutationCtx,
  RunQueryCtx,
  UseApi,
} from "./types";
import { DEFAULT_LOG_LEVEL, LogLevel } from "../component/logger";
import type { ActionArgs } from "../component/workflow/types";
import { StepStatus } from "../component/workflow/types";
import { LogLevel as WorkpoolLogLevel } from "@convex-dev/workpool";

export class WorkflowRunner {
  logLevel: LogLevel;
  workpoolLogLevel: LogLevel;
  /**
   * WorkflowRunner allows you to run workflows in Convex, that you defined
   * with the WorkflowRegistry.define() method.
   * This can be created and used in either the default or "node" runtime.
   *
   * @param component - The component to use, e.g. components.mastra
   *   imported like `import { components } from "./_generated/api"`.
   * @param options - Optional options.
   */
  constructor(
    public component: UseApi<typeof api>,
    public options?: {
      logLevel?: LogLevel;
      workpoolLogLevel?: WorkpoolLogLevel;
    }
  ) {
    this.logLevel = options?.logLevel ?? DEFAULT_LOG_LEVEL;
    this.workpoolLogLevel = options?.workpoolLogLevel ?? this.logLevel;
  }
  /**
   * Creates but does not start a new workflow run.
   * @param ctx - The context of the mutation or action.
   * @param fn - The function reference to the workflow. Like api.foo.bar.
   *   This is what you get from the WorkflowRegistry.define() call.
   * @returns An object with the run id and start and resume functions.
   */
  async create(
    ctx: RunMutationCtx,
    fn: FunctionReference<"action", "internal">
  ) {
    const fnHandle = await createFunctionHandle<"action", ActionArgs, null>(fn);
    const runId = await ctx.runMutation(this.component.workflow.index.create, {
      logLevel: this.logLevel,
      workpoolLogLevel: this.workpoolLogLevel,
      workflow: {
        fnHandle,
        fnName: getFunctionName(fn),
      },
    });
    return {
      runId,
      startAsync: this.startAsync.bind(this, ctx, runId),
      resumeAsync: this.resumeAsync.bind(this, ctx, runId),
    };
  }
  /**
   * Starts the workflow asynchronously. You can have it write to your tables
   * for reactivity, or you can subscribe to the results with getStatus, or
   * poll for results with waitForResult.
   * @param ctx - The context of the mutation or action.
   * @param runId - The id of the run from {@link create}.
   * @param opts - Any trigger data (initial input to the workflow).
   */
  async startAsync(
    ctx: RunMutationCtx,
    runId: string,
    opts: { triggerData?: unknown }
  ) {
    await ctx.runMutation(this.component.workflow.index.start, {
      workflowId: runId,
      triggerData: opts.triggerData,
    });
  }
  /**
   * Starts the workflow and waits for it to finish (via {@link waitForResult}).
   * @param ctx - The context of the action.
   * @param runId - The id of the run from {@link create}.
   * @param opts - Any trigger data (initial input to the workflow).
   * @returns The result of the workflow.
   */
  async start(
    ctx: RunActionCtx,
    runId: string,
    opts: { triggerData?: unknown }
  ) {
    await this.startAsync(ctx, runId, opts);
    return await this.waitForResult(ctx, runId);
  }
  /**
   * Resumes a workflow from a suspended step.
   * @param ctx - The context of the mutation or action.
   * @param runId - The id of the run from {@link create}.
   * @param resumeArgs - The step id and context to resume from.
   */
  async resumeAsync(
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
  /**
   * Resumes a workflow from a suspended step and waits for it to finish.
   * @param ctx - The context of the action.
   * @param runId - The id of the run from {@link create}.
   * @param resumeArgs - The step id and context to resume from.
   * @returns The result of the workflow.
   */
  async resume(
    ctx: RunActionCtx,
    runId: string,
    resumeArgs: { stepId: string; context: unknown }
  ) {
    await this.resumeAsync(ctx, runId, resumeArgs);
    return await this.waitForResult(ctx, runId);
  }
  /**
   * Polls for the result of a workflow.
   * Note: this is only allowed in actions.
   * The more idiomatic Convex way to do this is to subscribe to the results
   * with {@link getStatus}.
   * @param ctx - The context of the action.
   * @param runId - The id of the run from {@link create}.
   * @returns The result of the workflow.
   */
  async waitForResult(ctx: RunActionCtx, runId: string) {
    console.debug("Polling from client", runId);
    while (true) {
      const status = await this.getStatus(ctx, runId);
      if (!status) {
        return null;
      }
      // TODO: should this return if it's suspended?
      if (status.status === "finished") {
        return status;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  /**
   * Gets the status of a workflow. If called from a query, it will update
   * whenever the status changes.
   * @param ctx - The context of the query, mutation, or action.
   * @param runId - The id of the run from {@link create}.
   * @returns The status of the workflow.
   */
  async getStatus(ctx: RunQueryCtx, runId: string) {
    const status = await ctx.runQuery(this.component.workflow.index.status, {
      workflowId: runId,
    });
    if (!status) {
      console.debug("Workflow not found", runId);
      return null;
    }
    return {
      status: status.status,
      stepStates: status.stepStates?.reduce(
        (acc, stepState) => {
          if (stepState) {
            acc[stepState.stepId] = stepState.state;
          }
          return acc;
        },
        {} as Record<string, OpaqueIds<StepStatus>>
      ),
    };
  }
}
