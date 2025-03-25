import { Mastra } from "@mastra/core";
import { createLogger } from "@mastra/core/logger";

import { weatherAgent } from "./agents";
import { weatherToOutfitWorkflow } from "./workflows";
// import { ConvexStorage } from "@convex-dev/mastra/registry";

export const mastra = new Mastra({
  agents: { weatherAgent },
  workflows: { weatherToOutfitWorkflow },
  logger: createLogger({
    name: "Mastra",
    level: "info",
  }),
  // storage: new ConvexStorage(),
});
