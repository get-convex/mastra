# Convex Mastra Component

[![npm version](https://badge.fury.io/js/@convex-dev%2Fmastra.svg)](https://badge.fury.io/js/@convex-dev%2Fmastra)

<!-- START: Include on https://convex.dev/components -->

Use [Mastra](https://mastra.ai) to build workflows and define agents,
then use this component to run and save them on [Convex](https://convex.dev/).

1. Run workflows asynchronously. Fire and forget from a serverless function (mutation or action).
1. Track the status of the workflow. Reactive queries and run-to-completion utilities.
   Or just write to the database from your steps and use normal Convex reactivity.
1. Resume a workflow from where it left off, after suspending it for user input.
1. Full support for Mastra's step forking, joining, triggering, and more.

```ts
const storage = new ConvexStorage(components.mastra);
const vector = new ConvexVector(components.mastra);

// Uses storage to save and load messages and threads.
// Uses vector to save and query embeddings for RAG on messages.
const agent = new Agent({ memory: new Memory({ storage, vector}), ... })
// Uses storage to save and load workflow state.
const mastra = new Mastra({ storage, ...})

export const myAction = action({
  args: { workflowName: v.string()},
  handler: async (ctx, args) => {
    // IMPORTANT:
    // <- must be called before using storage or vector
    storage.setCtx(ctx);
    vector.setCtx(ctx);

    const workflow = mastra.getWorkflow(args.workflowName);
    const { runId, start } = await workflow.create(ctx);
    await start({...});
  }
})
```

### Use cases

- Agentic workflows, such as taking user input, calling multiple LLMs, calling third parties, etc.
- ... Everything else you want to do with Mastra.

Found a bug? Feature request? [File it here](https://github.com/get-convex/mastra/issues).

### Future work

- Provide Storage and Vector integrations for using Convex **from** Mastra servers.
  - Enables running from both `mastra dev` and `convex dev` for fast iterations.
  - Enables using Convex for Agent Memory.
- Provide helpers to export functions so browsers can call them safely.
- Add a custom mutation step, for a transactional step that will always terminate
  without needing a retry configuration (built-in for Convex).

## Pre-requisite: Convex

You'll need an existing Convex project to use the component.
Convex is a hosted backend platform, including a database, serverless functions,
and a ton more you can learn about [here](https://docs.convex.dev/get-started).

Run `npm create convex` or follow any of the [quickstarts](https://docs.convex.dev/home) to set one up.

## Installation

Install the component package:

```ts
npm install @convex-dev/mastra
```

**NOTE**: You also need to:

- Directly install `@libsql/client`
- Mark it as an external package
- Export it from a file in your /convex folder due to current bundling issues.

You can do all of this by running the following commands from the project root:

```sh
npm install -D @libsql/client
echo '{"node":{"externalPackages":["@libsql/client"]}}' > convex.json
printf '"use node";\nexport * as _ from "@libsql/client";' > convex/_workaround.ts
```

Create a `convex.config.ts` file in your app's `convex/` folder and install the component by calling `use`:

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import mastra from "@convex-dev/mastra/convex.config";

const app = defineApp();
app.use(mastra);

export default app;
```

## Usage

- It's important to call `storage.setCtx(ctx)` and `vector.setCtx(ctx)` before
  using the storage or vector in an action.

```ts
"use node";
const storage = new ConvexStorage(components.mastra);
const vector = new ConvexVector(components.mastra);

// Uses storage to save and load messages and threads.
// Uses vector to save and query embeddings for RAG on messages.
const agent = new Agent({ memory: new Memory({ storage, vector}), ... })
// Uses storage to save and load workflow state.
const mastra = new Mastra({ storage, ...})

export const myAction = action({
  args: { workflowName: v.string()},
  handler: async (ctx, args) => {
    // IMPORTANT:
    // <- must be called before using storage or vector
    storage.setCtx(ctx);
    vector.setCtx(ctx);

    const workflow = mastra.getWorkflow(args.workflowName);
    const { runId, start } = await workflow.create(ctx);
    await start({...});
  }
})
```

Querying the status reactively from a non-node file:

```ts
import { query } from "./_generated/server";
import { components } from "./_generated/api";
import { v } from "convex/values";
import {
  mapSerializedToMastra,
  TABLE_WORKFLOW_SNAPSHOT,
} from "@convex-dev/mastra/mapping";

export const getStatus = query({
  args: { runId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.runQuery(
      components.mastra.storage.storage.loadSnapshot,
      {
        workflowName: "weatherToOutfitWorkflow",
        runId: args.runId,
      }
    );
    if (!doc) {
      return null;
    }
    const snapshot = mapSerializedToMastra(TABLE_WORKFLOW_SNAPSHOT, doc);
    const { childStates, activePaths, suspendedSteps } = snapshot.snapshot;
    return { childStates, activePaths, suspendedSteps };
  },
});
```

See more example usage in [example.ts](./example/convex/example.ts).

## Limitations

1. For local development, you need to run `mastra dev` in Node 20, but
   `convex dev` in Node 18.
   If you see issues about syscalls at import time, try using the cloud dev
   environment instead.
1. Currently you can only interact with Mastra classes from Node actions, so
   you can't start them from a mutation without doing it indirectly via the
   Scheduler or Workpool by enqueuing the node action to run.
1. To reactively query for the status of a workflow, you need to call the
   component API directly. There's an example above and in
   [v8Runtime.ts](./example/convex/v8Runtime.ts).

### TODO before it's out of alpha

- [ ] Validate the Storage and Vector implementations (from Convex).
- [ ] Ensure @mastra/memory can be bundled in Convex.

### TODO before it's out of beta

- [ ] Support using Storage and Vector from `mastra dev`.
- [ ] Configurable vacuuming of workflow state.
- [ ] Support queries on workflow state without hitting the component directly.

### Backlog:

1. Support exposing the same `hono` HTTP API as Mastra servers.
1. Better logging and tracing.
1. Provide a Mutation Step to avoid the v8 action and is executed exactly once.
1. Workflows currently only run in Node Actions. You can create/start/resume
   them from anywhere, but each step will be executed in the node runtime.
   This is a bit slower and more expensive than running in the default runtime.
1. Using the `ConvexStorage` from Mastra doesn't share state with workflows
   made via the Component. They're currently stored in separate tables with
   different schemas.

## Troubleshooting

### Libsql errors

If you see an error like this:

```
Uncaught Failed to analyze _deps/node/4QMS5IZK.js: Cannot find module '@libsql/linux-arm64-gnu'
```

You need to add `@libsql/client` to the `externalPackages` in a `convex.json`
file in the root of your project:

```json
{
  "node": {
    "externalPackages": ["@libsql/client"]
  }
}
```

If that still doesn't solve it, add a `convex/_workaround.ts` file:

```ts
"use node";
export * as _ from "@libsql/client";
```

### Errors about 'no loader is configured for ".node" files'

If you see an error like this:

```
✘ [ERROR] No loader is configured for ".node" files: node_modules/onnxruntime-node/bin/napi-v3/win32/arm64/onnxruntime_binding.nodel
```

You're likely importing some node package through a dependency that isn't
supported. One workaround is to add it as an explicit dependency, then add it
to the `externalPackages` in a `convex.json` file in the root of your project,
then export something from it, similar to `@libsql/client` above

You can also try deleting your `node_modules` and `package-lock.json` and
re-installing using node 18.

### Errors about node packages not being available

```
✘ [ERROR] Could not resolve "assert"

    node_modules/sonic-boom/index.js:8:23:
      8 │ const assert = require('assert')
        ╵                        ~~~~~~~~

  The package "assert" wasn't found on the file system but is built into node. Are you trying to
  bundle for node? You can use "platform: 'node'" to do that, which will remove this error.
✖ It looks like you are using Node APIs from a file without the "use node" directive.
```

This is because you're using a Node API in a file that doesn't have
`"use node";` as the first line in the file
Or you're importing a file in your convex/ directory that imports from a
node dependency that doesn't have the `"use node"` directive.

To fix this, add the `"use node"` directive to the file. Note: these files can
only have actions, since mutations and queries only run in the default runtime.

<!-- END: Include on https://convex.dev/components -->
