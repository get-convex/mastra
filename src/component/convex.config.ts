import { defineComponent } from "convex/server";
import workpool from "@convex-dev/workpool/convex.config";

const component = defineComponent("mastra");
component.use(workpool);

export default component;
