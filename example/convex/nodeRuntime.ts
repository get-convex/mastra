"use node";
import { action, query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { WorkflowRunner } from "@convex-dev/mastra";
import { WorkflowRegistry } from "@convex-dev/mastra/registry";
import { Agent, createStep, Workflow } from "@mastra/core";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { v } from "convex/values";

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

const registry = new WorkflowRegistry(components.mastra);

export const workflowAction = registry.define(workflow, {
  agents: [agent],
});

// Can run this not in node:

const runner = new WorkflowRunner(components.mastra);

export const startWorkflow = action({
  args: {},
  handler: async (ctx, args) => {
    const { runId, startAsync } = await runner.create(
      ctx,
      internal.nodeRuntime.workflowAction
    );

    const result = await startAsync({
      name: "John Doe",
    });
    console.debug("Workflow result", result);
    return runner.getStatus(ctx, runId);
  },
});
