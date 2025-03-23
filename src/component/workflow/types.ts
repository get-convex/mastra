import { vRetryBehavior, workIdValidator } from "@convex-dev/workpool";
import { Infer, v } from "convex/values";

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
  payload: v.optional(v.any()),
  retryBehavior: v.optional(vRetryBehavior),
  kind:
    // v.union(
    v.literal("action"),
  //   v.literal("condition"),
  //   v.literal("pseudo")
  // ),
  // All steps that follow this one, pending conditions.
  childrenIds: v.optional(v.array(v.string())),
  // We evaluate all of these in the function that has in-memory copy of the
  // workflow.
  // condition: v.optional(
  //   v.union(
  //     v.object({
  //       kind: v.literal("function"),
  //       function: v.string(),
  //     }),
  //     v.object({
  //       kind: v.literal("simple"),
  //       expression: v.any(),
  //     })
  //   )
  // ),
  // variables: v.optional(v.record(v.string(), vVariableRef)),
  // outputMappings: v.optional(v.record(v.string(), v.string())),
  // parentStepId: v.optional(v.string()),
});
export type StepConfig = Infer<typeof stepConfig>;

export const stepStatus = v.union(
  v.object({
    kind: v.literal("waiting"),
    // waitingOn: v.array(v.string()),
  }),
  v.object({
    kind: v.literal("running"),
    inputStateIds: v.array(v.id("stepStates")),
    resumeData: v.optional(v.any()),
    workpoolId: workIdValidator,
  }),
  v.object({
    kind: v.literal("suspended"),
    inputStateIds: v.array(v.id("stepStates")),
    suspendPayload: v.any(),
  }),
  v.object({
    inputStateIds: v.array(v.id("stepStates")),
    kind: v.literal("skipped"),
  }),
  v.object({
    inputStateIds: v.array(v.id("stepStates")),
    kind: v.literal("success"),
    output: v.any(),
  }),
  v.object({
    inputStateIds: v.array(v.id("stepStates")),
    kind: v.literal("failed"),
    error: v.string(),
  })
);
export type StepStatus = Infer<typeof stepStatus>;

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
