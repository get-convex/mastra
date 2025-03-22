"use node";
import { action } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { WorkflowRunner } from "@convex-dev/mastra";
import { WorkflowRegistry } from "@convex-dev/mastra/registry";
import { Agent, createStep, Workflow } from "@mastra/core";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

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
    await suspend({ ask: "Can you help?" });
    return "Hello, world!";
  },
  outputSchema: z.string(),
});

const workflow = new Workflow({
  name: "workflow",
  triggerSchema: z.object({
    text: z.string(),
  }),
}).step(summarize, {
  variables: {
    text: { step: "trigger", path: "text" },
  },
});

const registry = new WorkflowRegistry(components.mastra, {
  logLevel: "DEBUG",
});

export const workflowAction = registry.define(workflow, {
  agents: [agent],
});

// Can run this not in node:

const runner = new WorkflowRunner(components.mastra);

export const startWorkflow = action({
  args: {},
  handler: async (ctx, args) => {
    const { runId, start } = await runner.create(
      ctx,
      internal.example.workflowAction
    );

    const result = await start({
      name: "John Doe",
    });
    console.debug("Workflow result", result);
    return result;
  },
});
