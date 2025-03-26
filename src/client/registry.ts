// Workaround to aid in bundling, to be combined with adding @libsql/client to
// the externalPackages in a convex.json file in the root of your project.
export * as libsql from "@libsql/client";

import {
  Agent,
  getStepResult,
  Step,
  StepCondition,
  StepGraph,
  StepNode,
  StepResult,
  VariableReference,
  WhenConditionReturnValue,
  Workflow,
  WorkflowContext,
} from "@mastra/core";
import { internalActionGeneric } from "convex/server";
import sift from "sift";
import type { Mounts } from "../component/_generated/api.js";
import { createLogger, Logger } from "../component/logger.js";
import {
  ActionArgs,
  actionArgs,
  NamedBranches,
  StepConfig,
  Target,
  WorkflowConfig,
} from "../component/workflow/types.js";
import { assert } from "../utils.js";
import { ConvexStorage } from "./storage.js";
import { UseApi } from "./types.js";
import { ConvexVector } from "./vector.js";
import { RetryBehavior } from "@convex-dev/workpool";

export const DEFAULT_RETRY_BEHAVIOR = {
  maxAttempts: 5,
  initialBackoffMs: 1000,
  base: 2,
};

export class WorkflowRegistry {
  defaultAgents: Agent[];
  defaultRetryBehavior: RetryBehavior;
  constructor(
    public component: UseApi<Mounts>,
    public options?: {
      /**
       * Agents that should use Convex for Storage and Vector
       */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      agents?: Agent<any>[];
      defaultRetryBehavior?: RetryBehavior;
    }
  ) {
    this.defaultAgents = options?.agents || [];
    this.defaultRetryBehavior =
      options?.defaultRetryBehavior || DEFAULT_RETRY_BEHAVIOR;
  }

  define(
    workflow: Workflow,
    options?: {
      /** Specify agents that should use Convex for Storage and Vector */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      agents?: Agent<any>[];
    }
  ) {
    const agents = new Set([
      ...this.defaultAgents,
      ...(options?.agents ??
        Object.values(
          Object.values(workflow.steps)
            .find((step) => step.mastra?.getAgents())
            ?.mastra?.getAgents() ?? {}
        )),
    ]);

    const action = internalActionGeneric({
      args: actionArgs,
      handler: async (ctx, args) => {
        const console = createLogger(args.logLevel);
        const op = args.op;
        if (op.kind === "getConfig") {
          console.debug("Getting config", workflow.name);
          return encodeWorkflow(workflow, this.defaultRetryBehavior);
        }
        for (const agent of agents) {
          const memory = agent.getMemory();
          if (memory?.vector instanceof ConvexVector) {
            memory.vector.ctx = ctx;
          }
          if (memory?.storage instanceof ConvexStorage) {
            memory.storage.ctx = ctx;
          }
        }

        if (op.kind === "run") {
          return await runStep(console, workflow, op);
        }
      },
    });
    return action;
  }
}

function encodeWorkflow(
  workflow: Workflow,
  defaultRetryBehavior: RetryBehavior
): WorkflowConfig {
  const stepConfigs: Record<string, StepConfig> = {};

  function addStepConfig(step: { id: string } & Partial<StepGeneric>) {
    if (stepConfigs[step.id]) {
      return;
    }
    globalThis.console.debug(`Adding step config for ${step.id}`);
    const retryBehavior = step.retryConfig ? defaultRetryBehavior : undefined;
    if (retryBehavior) {
      if (step.retryConfig?.attempts) {
        retryBehavior.maxAttempts = step.retryConfig.attempts;
      }
      if (step.retryConfig?.delay) {
        retryBehavior.initialBackoffMs = step.retryConfig.delay;
      }
    }
    stepConfigs[step.id] = {
      id: step.id,
      description: step.description,
      retryBehavior,
      kind: "action",
    };
  }
  for (const step of Object.values(workflow.steps)) {
    addStepConfig(step);
  }
  function sequencesFromGraph(graph: StepGraph): NamedBranches {
    const sequences: NamedBranches = {};
    for (const node of graph.initial) {
      addStepConfig(node.step);
      const stepId = node.step.id;
      const children = graph[stepId] ?? [];
      children.forEach((n) => addStepConfig(n.step));
      sequences[stepId] = [stepId, ...children.map((n) => n.step.id)];
    }
    return sequences;
  }
  const defaultBranches = sequencesFromGraph(workflow.stepGraph);
  const subscriberBranches: Record<string, NamedBranches> = {};
  for (const [event, graph] of Object.entries(workflow.stepSubscriberGraph)) {
    subscriberBranches[event] = sequencesFromGraph(graph);
  }

  return {
    name: workflow.name,
    stepConfigs,
    defaultBranches,
    subscriberBranches,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StepGeneric = Step<string, any, any, any>;
async function runStep(
  console: Logger,
  workflow: Workflow,
  op: ActionArgs["op"] & { kind: "run" }
): Promise<StepResult<unknown>> {
  let triggerData = op.triggerData;
  if (workflow.triggerSchema) {
    const validated = workflow.triggerSchema.safeParse(op.triggerData);
    if (!validated.success) {
      return {
        status: "failed",
        error: `Trigger data for workflow ${workflow.name} failed validation: ${validated.error.message}. Data: ${JSON.stringify(op.triggerData)}`,
      };
    }
    triggerData = validated.data;
  }
  const step = workflow.steps[op.target.id] as StepGeneric;
  const steps = op.steps as Record<string, StepResult<unknown>>;
  let node: StepNode;
  try {
    node = lookupNode(workflow, op.target);
  } catch (e) {
    return {
      status: "failed",
      error: e instanceof Error ? e.message : "Unknown error finding step",
    };
  }
  const { data: variables, handler } = node.config;
  const resolvedData =
    variables &&
    typeof variables === "object" &&
    Object.keys(variables).length > 0
      ? inputFromVariables({ variables, triggerData, steps })
      : triggerData;
  let inputData = {
    // resumedEvent: ..?
    ...resolvedData,
    ...op.resumeData,
    ...(step.payload ?? {}), // Also done by handler internally..
  };
  if (step.inputSchema) {
    const validated = step.inputSchema.safeParse(inputData);
    if (!validated.success) {
      console.warn(
        `Input data for step ${step.id} failed validation: ${JSON.stringify(
          inputData
        )}\n${validated.error.message}`
      );
      return { status: "failed", error: validated.error.message };
    }
    inputData = validated.data;
  }
  const context: WorkflowContext = {
    steps,
    triggerData,
    inputData,
    attempts: {}, // we handle retries ourselves
    getStepResult: (idOrStep: string | Step) => {
      const stepId = typeof idOrStep === "string" ? idOrStep : idOrStep.id;
      if (stepId === "trigger") {
        return triggerData;
      }
      const stepResult = steps[stepId];
      if (!stepResult || stepResult.status !== "success") {
        return undefined;
      }
      return stepResult.output;
    },
    // TODO: add mastra?
    // mastra,
  };
  const whenStatus = await conditionCheck(console, op.runId, context, node);
  if (whenStatus) {
    return whenStatus;
  }
  let suspendPayload: unknown;
  let suspended = false;

  try {
    // difference from step.execute is tracing and payload afaict
    const output = await handler({
      runId: op.runId,
      // threadId: op.threadId, ?
      // resourceId: op.resourceId, ?
      context,
      suspend: async (payload: unknown) => {
        console.debug(`Suspending ${step.id} run ${op.runId}`, payload);
        suspendPayload = payload;
        suspended = true;
      },
    });
    if (suspended) {
      return { status: "suspended", suspendPayload };
    }
    if (output && step.outputSchema) {
      const validated = step.outputSchema.safeParse(output);
      if (validated.success) {
        return { status: "success", output: validated.data };
      } else {
        return { status: "failed", error: validated.error.message };
      }
    }
    return { status: "success", output };
  } catch (e) {
    console.debug(`Step ${step.id} failed in run ${op.runId}`, e);
    // If it fails, the workpool will handle retries and final failure
    throw e;
  }
}

// Resolves the .step(foo, {variables: ...}) variables from steps data.
// Note: This function mostly cribbed from `@mastra/core` package. ISC /EL2 licensed.
// If it were factored out there I'd use it directly, but it's a private function atm.
function inputFromVariables(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  variables: Record<string, VariableReference<any, any>>;
  triggerData: unknown;
  steps: Record<string, StepResult<unknown>>;
}): Record<string, unknown> {
  const data = Object.fromEntries(
    Object.entries(args.variables).map(([key, variable]) => {
      const sourceData =
        variable.step === "trigger"
          ? args.triggerData
          : getStepResult(args.steps[variable.step.id]);

      if (!sourceData && variable.step !== "trigger") {
        return [key, undefined];
      }

      // If path is empty or '.', return the entire source data
      const value =
        !variable.path || variable.path === "."
          ? sourceData
          : getValueFromPath(sourceData, variable.path);

      return [key, value];
    })
  );

  return data;
}

// Looks up things by:
// - dot notation a.b.c
// - bracket notation a[b][c]
// - single bracket notation a[b]
// - single quote notation a['b']
// - double quote notation a["b"]
// - array notation a[1]
// - mixed notations a.b['c']
// It fails on: escaped and mixed quotes like a.b["c'"] or a.b['c\'c']
// Note: This function mostly cribbed from `raddash` package. MIT licensed.
function getValueFromPath(value: unknown, path: string) {
  const segments = path.split(/[.[\]]/g);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = value;
  for (let key of segments) {
    if (current === null || current === undefined) return undefined;
    if (key.startsWith("'") || key.startsWith('"')) {
      key = key.slice(1);
    }
    if (key.endsWith("'") || key.endsWith('"')) {
      key = key.slice(0, -1);
    }
    if (key.trim() === "") continue;
    if (typeof current !== "object" || current === null) return undefined;
    current = current[key];
  }
  return current;
}

function lookupNode(workflow: Workflow, target: Target): StepNode {
  const source =
    target.kind === "default"
      ? workflow.stepGraph
      : workflow.stepSubscriberGraph[target.event];
  let node: StepNode | undefined;
  if (target.index === 0) {
    node = source.initial.find((n) => n.step.id === target.id);
  } else {
    node = source[target.branch][target.index - 1];
  }
  assert(
    node,
    `The step ${target.id} is not part of the workflow ${workflow.name} ` +
      `in ${target.kind} branch ${target.branch} at index ${target.index}. ` +
      `Did you edit the workflow?`
  );
  assert(
    node.step.id === target.id,
    `The step ${target.id} isn't where it's supposed to be in the workflow "${workflow.name}" ` +
      `in ${target.kind} branch ${target.branch} at index ${target.index}. ` +
      `Instead, that location has the step ${node.step.id}.` +
      `Did you edit the workflow?`
  );
  return node;
}

async function conditionCheck(
  console: Logger,
  runId: string,
  context: WorkflowContext,
  stepNode: StepNode
): Promise<StepResult<never> | undefined> {
  const {
    config: { when },
    step: { id: stepId },
  } = stepNode;
  if (!when) {
    return undefined;
  }
  if (typeof when !== "function") {
    if (!evaluateCondition(console, runId, when, context)) {
      return { status: "failed", error: "Condition check failed." };
    }
    return undefined;
  }
  const conditionMet = await when({ context });
  switch (conditionMet) {
    case false:
      console.debug(`Conditions for step ${stepId} in run ${runId} failed`);
      return { status: "failed", error: "Condition check failed." };
    case true:
    case WhenConditionReturnValue.CONTINUE:
      return undefined;
    case WhenConditionReturnValue.LIMBO:
      console.debug(`Conditions for step ${stepId} in run ${runId} in limbo`);
      return { status: "skipped" };
    case WhenConditionReturnValue.ABORT:
      console.debug(`Conditions for step ${stepId} in run ${runId} aborted`);
      return { status: "skipped" };
    case WhenConditionReturnValue.CONTINUE_FAILED:
      console.debug(`Conditions for step ${stepId} in run ${runId} failed`);
      return { status: "failed", error: "Condition check failed" };
  }
}

function evaluateCondition(
  console: Logger,
  runId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  condition: StepCondition<any, any>,
  context: WorkflowContext
): boolean {
  let andBranchResult = true;
  let baseResult = true;
  let orBranchResult = true;

  // Base condition simplified format
  // TODO: pretty sure this should do the simple check for EVERY one with a .
  const simpleCondition = Object.entries(condition).find(([key]) =>
    key.includes(".")
  );
  if (simpleCondition) {
    const [key, queryValue] = simpleCondition;
    const [stepId, ...pathParts] = key.split(".");
    const path = pathParts.join(".");

    const sourceData =
      stepId === "trigger"
        ? context.triggerData
        : getStepResult(context.steps[stepId as string]);

    if (!sourceData) {
      console.debug(`No condition data for step ${stepId} in run ${runId}`);
      return false;
    }

    let value = getValueFromPath(sourceData, path);

    // If path is 'status', check if value is empty and we are not referencing the trigger.
    // Currently only successful step results get to this point, so we can safely assume that the status is 'success'
    if (stepId !== "trigger" && path === "status" && !value) {
      value = "success";
    }

    // Handle different types of queries
    if (typeof queryValue === "object" && queryValue !== null) {
      // If it's an object, treat it as a query object
      baseResult = sift(queryValue)(value);
    } else {
      // For simple values, do an equality check
      baseResult = value === queryValue;
    }
  }

  // Base condition
  if ("ref" in condition) {
    const { ref, query } = condition;
    const sourceData =
      ref.step === "trigger"
        ? context.triggerData
        : getStepResult(context.steps[ref.step.id]);

    if (!sourceData) {
      console.debug(
        `No condition data for ${JSON.stringify(ref)} in run ${runId}`
      );
      return false;
    }

    let value = getValueFromPath(sourceData, ref.path);

    // If path is 'status', check if value is empty and we are not referencing the trigger.
    // Currently only successful step results get to this point, so we can safely assume that the status is 'success'
    if (ref.step !== "trigger" && ref.path === "status" && !value) {
      value = "success";
    }

    baseResult = sift(query)(value);
  }

  // AND condition
  if ("and" in condition) {
    andBranchResult = condition.and.every((cond) =>
      evaluateCondition(console, runId, cond, context)
    );
  }

  // OR condition
  if ("or" in condition) {
    orBranchResult = condition.or.some((cond) =>
      evaluateCondition(console, runId, cond, context)
    );
  }

  if ("not" in condition) {
    baseResult = !evaluateCondition(console, runId, condition.not, context);
  }

  const finalResult = baseResult && andBranchResult && orBranchResult;

  return finalResult;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const console = "THIS IS A REMINDER TO USE createLogger";
