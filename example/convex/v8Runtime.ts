import { action } from "./_generated/server";
import { components, internal } from "./_generated/api";
import {} from // Agent,
// createStep,
// Mastra,
// Workflow,
"@mastra/core";
// import { openai } from "@ai-sdk/openai";
import { z } from "zod";
// import { weatherAgent, outfitAgent } from "../src/mastra/agents";
// import { weatherToOutfitWorkflow } from "../src/mastra/workflows/index";
// import { ConvexStorage } from "@convex-dev/mastra/storage";

// TODO: is this still necessary?
import crypto from "crypto";
// ts-ignore
globalThis.crypto = crypto as any;

// const storage = new ConvexStorage(components.mastra);

// const agent = new Agent({
//   name: "summarizer",
//   instructions: "You are a helpful assistant that summarizes text.",
//   model: openai("gpt-4o"),
// });

// const summarize = createStep({
//   id: "summarize",
//   inputSchema: z.object({
//     text: z.string(),
//   }),
//   async execute({ context, suspend, resourceId, threadId }) {
//     // const console = createLogger(context.logLevel);
//     console.debug({ threadId, resourceId, context });
//     console.info("Summarizing text", { text: context.inputData.text });
//     // const result = await agent.generate(context.inputData.text);
//     // await suspend({ ask: "Can you help?" });
//     // return result.text;
//     return "Hello, world!" + context.inputData.text;
//   },
//   outputSchema: z.string(),
// });
// const A = createStep({
//   id: "A",
//   execute: async ({ context, suspend }) => {
//     console.info("A");
//     return "A";
//   },
// });
// const B = createStep({
//   id: "B",
//   execute: async ({ context }) => {
//     console.info("B");
//     return "B";
//   },
// });
// const C = createStep({
//   id: "C",
//   execute: async ({ context }) => {
//     console.info("C");
//     return "C";
//   },
// });
// const D = createStep({
//   id: "D",
//   execute: async ({ context }) => {
//     console.info("D");
//     return "D";
//   },
// });
// const E = createStep({
//   id: "E",
//   execute: async ({ context }) => {
//     console.info("E");
//     return "E";
//   },
// });
// const Counter = createStep({
//   id: "Counter",
//   execute: async ({ context }) => {
//     const previous = context.getStepResult("Counter");
//     return { count: (previous?.count ?? 0) + 1 };
//   },
//   outputSchema: z.object({
//     count: z.number(),
//   }),
// });
// const SuspendsUntilHumanInput = createStep({
//   id: "SuspendsUntilHumanInput",
//   inputSchema: z.object({
//     human: z.string().optional(),
//   }),
//   execute: async ({ context, suspend }) => {
//     console.info("SuspendsUntilHumanInput");
//     if (context.inputData.human) {
//       console.info("Human message", context.inputData.human);
//     } else {
//       console.info("Suspending until human input");
//       await suspend({ ask: "Can you help?" });
//     }
//     return "SuspendsUntilHumanInput";
//   },
// });
// const RetryOnce = createStep({
//   id: "RetryOnce",
//   execute: async ({ context }) => {
//     const previous = context.getStepResult("RetryOnce");
//     if (previous) {
//       return { status: "success" };
//     }
//     return { status: "retry" };
//   },
// });
// const FailsOnSecondRun = createStep({
//   id: "FailsOnSecondRun",
//   execute: async ({ context }) => {
//     const previous = context.getStepResult("FailsOnSecondRun");
//     console.info("FailsOnSecondRun", previous);
//     if (previous) throw new Error("FailsOnSecondRun already ran");
//     return (previous ?? 0) + 1;
//   },
// });
// const Fail = createStep({
//   id: "Fail",
//   execute: async ({ context }) => {
//     console.info("Fail");
//     throw new Error("Fail");
//   },
// });
// const workflow = new Workflow({
//   name: "workflow",
//   triggerSchema: z.object({
//     text: z.string(),
//     nested: z.object({
//       text: z.string(),
//     }),
//   }),
// })
//   .step(A)
//   .then(Counter, {
//     when: {
//       ref: {
//         step: A,
//         path: ".",
//       },
//       query: {
//         $eq: "A",
//       },
//     },
//   })
//   // .if(async ({ context }) => context.getStepResult("A") === "A")
//   // .then(B)
//   // .step(Fail)
//   // .after([A, Fail])
//   //   .step(C)
//   // .after(A)
//   .step(B)
//   .then(C, {
//     when: {
//       ref: {
//         step: { id: "B" },
//         path: "status",
//       },
//       query: {
//         $eq: "success",
//       },
//     },
//   })
//   .after([A, C])
//   .step(D, {
//     when: {
//       "B.status": "success",
//     },
//   })
//   .then(Counter)
//   .after(B)
//   // skip
//   .step(Fail, {
//     when: { "RetryOnce.status": "retry" },
//   })
//   .step(RetryOnce)
//   .until(async ({ context }) => context.getStepResult("Counter") === 5, Counter)
//   .step(E, {
//     when: {
//       ref: {
//         step: { id: "Counter" },
//         path: "count",
//       },
//       query: { $lt: 5 },
//     },
//   })
//   .step(RetryOnce, {
//     when: {
//       and: [
//         {
//           ref: {
//             step: { id: "Counter" },
//             path: "status",
//           },
//           query: {
//             $eq: "success",
//           },
//         },
//         {
//           ref: {
//             step: { id: "Counter" },
//             path: "count",
//           },
//           query: {
//             $eq: 5,
//           },
//         },
//       ],
//     },
//   })

// .step(summarize, {
//   variables: {
//     text: { step: "trigger", path: "nested.text" },
//   },
// })
// .commit();

// Can run this not in node:
// const mastra = new Mastra({
//   agents: {
//     weatherAgent,
//     outfitAgent,
//   },
//   // storage,
//   workflows: {
//     workflow,
//   },
// });
// type M = ReturnType<typeof mastra.getAgent<"weatherAgent">>;

export const startWorkflow = action({
  args: {},
  handler: async (ctx) => {
    // const w = mastra.getWorkflow("workflow");
    // const w = workflow;
    // console.debug({
    //   stepGraph: workflow.stepGraph,
    //   stepSubscriberGraph: workflow.stepSubscriberGraph,
    //   serializedStepGraph: JSON.stringify(
    //     workflow.serializedStepGraph,
    //     null,
    //     2
    //   ),
    //   serializedStepSubscriberGraph: JSON.stringify(
    //     workflow.serializedStepSubscriberGraph,
    //     null,
    //     2
    //   ),
    // });
    // return;
    // const w = mastra.getWorkflow("workflow");
    // const { runId, start, resume } = w.createRun();
    // return runId;
    // return runner.waitForResult(ctx, runId);
    // console.debug("Workflow result", runId, result);
    // await new Promise((resolve) => setTimeout(resolve, 1000));
    // const afterResume = await resume({
    //   stepId: "A",
    //   context: {
    //     human: "Here is a human message",
    //   },
    // });
    // console.debug("After resume", afterResume);
    // return JSON.stringify(result, null, 2);
  },
});
