import { Agent, createStep, Mastra, Workflow } from "@mastra/core";
import { z } from "zod";
import { outfitAgent, weatherAgent } from "../agents";

export const getWeather = createStep({
  id: "getWeather",
  description: "Gets the weather for a location",
  inputSchema: z.object({
    location: z.string(),
  }),
  outputSchema: z.object({
    weather: z.string(),
  }),
  execute: async ({ context, suspend }) => {
    const weather = await weatherAgent.generate(
      `What's the weather in ${context.inputData.location}?`
    );
    return { weather: weather.text };
  },
});

export const getOutfit = createStep({
  id: "getOutfit",
  description: "Gets the outfit for a location",
  inputSchema: z.object({
    location: z.string(),
    weather: z.string(),
  }),
  outputSchema: z.object({
    outfit: z.string(),
  }),
  execute: async ({ context, suspend, resourceId, threadId, runId }) => {
    const outfit = await outfitAgent.generate([
      {
        role: "user",
        content: `What's the outfit for ${context.inputData.weather} in ${context.inputData.location}?`,
      },
    ]);
    return { outfit: outfit.text };
  },
});

export const refineOutfit = createStep({
  id: "refineOutfit",
  description: "Refines the outfit",
  inputSchema: z.object({
    outfit: z.string(),
    refinement: z.union([z.string(), z.literal(null)]).optional(),
  }),
  async execute({ context, suspend, resourceId, threadId, runId }) {
    const previous = context.getStepResult("refineOutfit");
    if (!previous) {
      console.log("suspending", context.inputData.outfit);
      await suspend({
        ask: `Do you want to change anything?`,
        outfit: context.inputData.outfit,
      });
      return { outfit: context.inputData.outfit };
    }
    if (
      !context.inputData.refinement ||
      context.inputData.refinement.toLowerCase().startsWith("no ")
    ) {
      return { outfit: previous.outfit };
    }
    console.log("refining outfit", previous.outfit, context);
    // TODO: use memory for full history
    const refinement = await outfitAgent.generate([
      {
        role: "user",
        content: `What's the outfit for ${context.inputData.weather} in ${context.inputData.location}?`,
      },
      {
        role: "assistant",
        content: previous.outfit,
      },
      {
        role: "user",
        content: context.inputData.refinement,
      },
    ]);
    await suspend({ ask: `How about this?`, outfit: refinement.text });
    return { outfit: refinement.text };
  },
  outputSchema: z.object({
    outfit: z.string(),
  }),
});

export const weatherToOutfitWorkflow = new Workflow({
  name: "weatherToOutfit",
  triggerSchema: z.object({
    location: z.string(),
  }),
})
  .step(getWeather, {
    variables: {
      location: {
        step: "trigger",
        path: "location",
      },
    },
  })
  .then(getOutfit, {
    variables: {
      location: {
        step: "trigger",
        path: "location",
      },
      weather: {
        step: getWeather as any,
        path: "weather",
      },
    },
  })
  .then(refineOutfit, {
    variables: {
      outfit: {
        step: getOutfit as any,
        path: "outfit",
      },
      refinement: {
        step: refineOutfit as any,
        path: "refinement",
      },
    },
  });
