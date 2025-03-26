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
const A = createStep({
  id: "A",
  execute: async ({ context, suspend }) => {
    console.info("A");
    return "A";
  },
});
const B = createStep({
  id: "B",
  execute: async ({ context }) => {
    console.info("B");
    return "B";
  },
});
const C = createStep({
  id: "C",
  execute: async ({ context }) => {
    console.info("C");
    return "C";
  },
});
const D = createStep({
  id: "D",
  execute: async ({ context }) => {
    console.info("D");
    return "D";
  },
});
const E = createStep({
  id: "E",
  execute: async ({ context }) => {
    console.info("E");
    return "E";
  },
});
const Counter = createStep({
  id: "Counter",
  execute: async ({ context }) => {
    const previous = context.getStepResult("Counter");
    return { count: (previous?.count ?? 0) + 1 };
  },
  outputSchema: z.object({
    count: z.number(),
  }),
});
const SuspendsUntilHumanInput = createStep({
  id: "SuspendsUntilHumanInput",
  inputSchema: z.object({
    human: z.string().optional(),
  }),
  execute: async ({ context, suspend }) => {
    console.info("SuspendsUntilHumanInput");
    if (context.inputData.human) {
      console.info("Human message", context.inputData.human);
    } else {
      console.info("Suspending until human input");
      await suspend({ ask: "Can you help?" });
    }
    return "SuspendsUntilHumanInput";
  },
});
const RetryOnce = createStep({
  id: "RetryOnce",
  execute: async ({ context }) => {
    const previous = context.getStepResult("RetryOnce");
    if (previous) {
      return { status: "success" };
    }
    return { status: "retry" };
  },
});
const FailsOnSecondRun = createStep({
  id: "FailsOnSecondRun",
  execute: async ({ context }) => {
    const previous = context.getStepResult("FailsOnSecondRun");
    console.info("FailsOnSecondRun", previous);
    if (previous) throw new Error("FailsOnSecondRun already ran");
    return (previous ?? 0) + 1;
  },
});
const Fail = createStep({
  id: "Fail",
  execute: async ({ context }) => {
    console.info("Fail");
    throw new Error("Fail");
  },
});

export const whenTest = new Workflow({
  name: "whenTest",
  triggerSchema: z.object({
    text: z.string(),
    nested: z.object({
      text: z.string(),
    }),
  }),
})
  .step(A)
  .then(Counter)
  // .if(async ({ context }) => context.getStepResult("A") === "A")
  // .then(B)
  // .step(Fail)
  // .after([A, Fail])
  //   .step(C)
  .after(A)
  .step(B, {
    when: {
      "A.status": "success",
      // ref: {
      //   step: A,
      //   path: ".",
      // },
      // query: {
      //   $eq: "A",
      // },
    },
  })
  // .then(C, {
  //   when: {
  //     ref: {
  //       step: { id: "B" },
  //       path: "status",
  //     },
  //     query: {
  //       $eq: "success",
  //     },
  //   },
  // })
  // .after([A, C])
  // .step(D, {
  //   when: {
  //     "B.status": "success",
  //   },
  // })
  // .then(Counter)
  // .after(B)
  // // skip
  // .step(Fail, {
  //   when: { "RetryOnce.status": "retry" },
  // })
  // .until(async ({ context }) => context.getStepResult("Counter") === 5, Counter)
  // .step(E, {
  //   when: {
  //     ref: {
  //       step: { id: "Counter" },
  //       path: "count",
  //     },
  //     query: { $lt: 5 },
  //   },
  // })
  // .step(RetryOnce, {
  //   when: {
  //     and: [
  //       {
  //         ref: {
  //           step: { id: "Counter" },
  //           path: "status",
  //         },
  //         query: {
  //           $eq: "success",
  //         },
  //       },
  //       {
  //         ref: {
  //           step: { id: "Counter" },
  //           path: "count",
  //         },
  //         query: {
  //           $eq: 5,
  //         },
  //       },
  //     ],
  //   },
  // })
  .commit();
