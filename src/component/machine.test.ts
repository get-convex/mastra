/// <reference types="vite/client" />

import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema.js";
import { api } from "./_generated/api.js";

const modules = import.meta.glob("./**/*.*s");

describe("mastra", () => {
  test("add and subtract", async () => {
    const t = convexTest(schema, modules);
  });
});
