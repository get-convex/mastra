import { defineApp } from "convex/server";
import mastra from "@convex-dev/mastra/convex.config.js";

const app = defineApp();
app.use(mastra);

export default app;
