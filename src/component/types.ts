import { vRetryBehavior } from "@convex-dev/workpool";
import { Infer, ObjectType, v } from "convex/values";
import { logLevel } from "./logger";

// Just for readability
export const vStepId = v.string();

export const vVariableRef = v.object({
  kind: v.literal("step"),
  step: v.union(v.string(), v.literal("trigger")),
  path: v.string(),
});

// One per step definition, not updated during workflow execution.
export const stepConfig = v.object({
  id: vStepId,
  description: v.optional(v.string()),
  retryBehavior: v.optional(vRetryBehavior),
  kind:
    // v.union(
    v.literal("action"),
  //   v.literal("mutation"),
  //   v.literal("workflow"),
  // ),
});
export type StepConfig = Infer<typeof stepConfig>;

export const stepStatus = v.union(
  v.object({
    status: v.literal("waiting"),
  }),
  v.object({
    status: v.literal("suspended"),
    suspendPayload: v.optional(v.any()),
  }),
  v.object({
    status: v.literal("skipped"),
  }),
  v.object({
    status: v.literal("success"),
    output: v.optional(v.any()),
  }),
  v.object({
    status: v.literal("failed"),
    error: v.string(),
  })
);
export type StepStatus = Infer<typeof stepStatus>;

export const vTarget = v.union(
  v.object({
    kind: v.literal("default"),
    branch: vStepId,
    index: v.number(),
    id: vStepId,
  }),
  v.object({
    kind: v.literal("subscriber"),
    event: v.string(), // e.g. A&&B
    branch: vStepId,
    index: v.number(),
    id: vStepId,
  })
);
export type Target = Infer<typeof vTarget>;

export const actionArgs = {
  logLevel,
  op: v.union(
    v.object({
      kind: v.literal("getConfig"),
    }),
    v.object({
      kind: v.literal("run"),
      runId: v.string(),
      // Whether it's in stepGraph or stepSubscriberGraph
      target: vTarget,
      triggerData: v.any(),
      resumeData: v.optional(v.record(v.string(), v.any())),
      steps: v.record(v.string(), stepStatus),
    })
  ),
};
export type ActionArgs = ObjectType<typeof actionArgs>;

export const vNamedBranches = v.record(vStepId, v.array(vStepId));
export type NamedBranches = Infer<typeof vNamedBranches>;

export const vWorkflowConfig = v.object({
  name: v.string(),
  stepConfigs: v.record(vStepId, stepConfig),
  defaultBranches: vNamedBranches,
  // event -> branch -> sequence
  // where event is like "A&&B" for subscribing to both A and B.
  subscriberBranches: v.record(v.string(), vNamedBranches),
});
export type WorkflowConfig = Infer<typeof vWorkflowConfig>;

export type Transitions = {
  id: string;
  state: StepStatus;
};

// export type vCondition = v.union(
//   vBaseCondition,
//   vSimpleCondition,
//   vAndCondition,
//   vOrCondition,
//   vNotCondition
// );

// export const vValueQuery = v.object({

// });

// export const vShapeQuery;

// export const vNestedQuery = v.object({
//   ...vValueQuery.fields,
//   ...vShapeQuery.fields,
// });

// export const vItemQuery = v.any();

// export const vRegexQuery = v.string();

// export const vQuery = v.union(
//   vItemQuery, vRegexQuery, vNestedQuery,
// )

// export type vBaseCondition = v.object({
//   kind: v.literal("base"),

//     ref:;

//     query: Query<any>;
//   expression: v.string(),
//   evaluatorStepId: v.optional(v.string()),
// });

// | BaseCondition<TStep, TTriggerSchema>
// | SimpleConditionalType
// | { and: Condition<TStep, TTriggerSchema>[] }
// | { or: Condition<TStep, TTriggerSchema>[] }
// | { not: Condition<TStep, TTriggerSchema> };
