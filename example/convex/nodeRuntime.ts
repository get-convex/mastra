"use node";
import { action, query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { WorkflowRunner } from "@convex-dev/mastra";
import { ConvexStorage, WorkflowRegistry } from "@convex-dev/mastra/registry";
import { Agent, createStep, Mastra, Workflow } from "@mastra/core";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { v } from "convex/values";

import crypto from "crypto";
// ts-ignore
globalThis.crypto = crypto as any;

const agent = new Agent({
  name: "summarizer",
  instructions: "You are a helpful assistant that summarizes text.",
  model: openai("gpt-4o"),
});

const summarize = createStep({
  id: "summarize",
  inputSchema: z.object({
    text: z.string(),
  }),
  async execute({ context, suspend, resourceId, threadId }) {
    // const console = createLogger(context.logLevel);
    console.debug({ threadId, resourceId, context });
    console.info("Summarizing text", { text: context.inputData.text });
    // const result = await agent.generate(context.inputData.text);
    // await suspend({ ask: "Can you help?" });
    // return result.text;
    return "Hello, world!" + context.inputData.text;
  },
  outputSchema: z.string(),
});
const A = createStep({
  id: "A",
  execute: async ({ context, suspend }) => {
    console.info("A");
    // console.info("Before", context.inputData);
    // if ("human" in context.inputData) {
    //   console.info("Human message", context.inputData.human);
    // } else {
    //   await suspend({ ask: "Can you help?" });
    // }
    // console.info("After");
  },
});
const B = createStep({
  id: "B",
  execute: async ({ context }) => {
    const previous = context.getStepResult("B");
    console.info("B", previous);
    if (previous) throw new Error("B already ran");
    return (previous ?? 0) + 1;
  },
});
const C = createStep({
  id: "C",
  execute: async ({ context }) => {
    console.info("C");
    // const previous = context.getStepResult("C");
    // if (previous) {
    //   return { status: "success" };
    // }
    // return { status: "retry" };
  },
});
const D = createStep({
  id: "D",
  execute: async ({ context }) => {
    console.info("D");
  },
});
const E = createStep({
  id: "E",
  execute: async ({ context }) => {
    console.info("E");
  },
});
const Fail = createStep({
  id: "Fail",
  execute: async ({ context }) => {
    console.info("Fail");
    throw new Error("Fail");
  },
});
const workflow = new Workflow({
  name: "workflow",
  triggerSchema: z.object({
    text: z.string(),
    nested: z.object({
      text: z.string(),
    }),
  }),
})
  .step(A)
  //   .step(Fail)
  //   .after([A, Fail])
  //   .step(C)
  // .after(A)
  .step(B)
  .then(C)
  // .then(D)
  // .step(D)
  // .after(D)
  // .then(D)
  // .then(B)
  // .step(C)
  // .then(B);
  // .step(B)
  // .until(async ({ context }) => context.getStepResult("B") === 3, B)
  // .step(C)
  // .step(D);
  // .then(D);
  // .after(B)
  // .step(A, {
  //   // when: { "B.status": "retry" },
  //   when: async ({ context }) => context.getStepResult("B") === "foo",
  // });
  // .after([A, B])
  // .step(A)
  // .then(B)
  // .while(async ({ context }) => context.inputData.text === "B", A)
  //   .then(C)
  // .until(async () => true, D)
  // .after(B)
  // .step(D)
  // .then(E);
  // .then(C);
  // when: ({ context }) => context.inputData.text === "B",
  // }).step(C, {
  //   when: ({ context }) => context.inputData.text === "C",
  // }).step(D, {
  //   when: ({ context }) => context.inputData.text === "D",
  // })

  .step(summarize, {
    variables: {
      text: { step: "trigger", path: "nested.text" },
    },
  })
  .commit();

const registry = new WorkflowRegistry(components.mastra);

export const workflowAction = registry.define(workflow, {
  agents: [agent],
});

// Can run this not in node:

const runner = new WorkflowRunner(components.mastra, {
  logLevel: "DEBUG",
  workpoolLogLevel: "INFO",
});

export const startWorkflow = action({
  args: {},
  handler: async (ctx) => {
    const { runId } = await runner.create(
      ctx,
      internal.nodeRuntime.workflowAction
    );
    const result = await runner.startAsync(ctx, runId, {
      triggerData: { text: "John Doe", nested: { text: "Nested text" } },
    });
    console.debug("Workflow result", runId, result);

    return await runner.waitForResult(ctx, runId);
  },
});
const storage = new ConvexStorage(components.mastra);
const mastra = new Mastra({
  storage,
  workflows: {
    workflow,
  },
});

export const t = action({
  args: {},
  handler: async (ctx) => {
    storage.ctx = ctx;

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
    // const { runId, start, resume } = workflow.createRun();
    // const w = mastra.getWorkflow("workflow");
    // const { runId, start, resume } = w.createRun();
    const { runId, startAsync } = await runner.create(
      ctx,
      internal.nodeRuntime.workflowAction
    );
    await startAsync({
      triggerData: { text: "John Doe", nested: { text: "Nested text" } },
    });
    return runner.waitForResult(ctx, runId);
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
