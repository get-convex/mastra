import { v, Validator } from "convex/values";
import tables from "./tables.js";
import { internal } from "../_generated/api.js";
import { TableNames } from "./tables.js";
import {
  action,
  internalMutation,
  mutation,
  query,
} from "../_generated/server.js";
import { paginator } from "convex-helpers/server/pagination";
import schema from "../schema.js";

interface StorageColumn {
  type: "text" | "timestamp" | "uuid" | "jsonb" | "integer" | "bigint";
  primaryKey?: boolean;
  nullable?: boolean;
  references?: {
    table: string;
    column: string;
  };
}

export function validateTableSchema(
  tableName: TableNames,
  tableSchema: Record<string, StorageColumn>
) {
  if (!tables[tableName]) {
    throw new Error(`Table ${tableName} not found in schema`);
  }
  const table = tables[tableName];
  const fields = table.validator.fields;
  for (const [name, field] of Object.entries(tableSchema)) {
    if (!(name in fields)) {
      throw new Error(`Field ${name} not found in schema for ${tableName}`);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let convexValue: Validator<any>["kind"];
    switch (field.type) {
      case "text":
        convexValue = "string";
        break;
      case "integer":
        convexValue = "int64";
        break;
      case "bigint":
        convexValue = "int64";
        break;
      case "timestamp":
        convexValue = "int64";
        break;
      case "jsonb":
        convexValue = "any";
        break;
      case "uuid":
        convexValue = "string";
        break;
    }
    if (!convexValue) {
      throw new Error(
        `Unexpected field type ${field.type} for ${name} in ${tableName}`
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expected = fields[name as keyof typeof fields] as Validator<any, any>;
    if (expected.type !== convexValue) {
      throw new Error(
        `Field ${name} in table ${tableName} was expected to be a ${convexValue} but got ${expected.type}`
      );
    }
    if (expected.isOptional === "required" && field.nullable) {
      throw new Error(
        `Field ${name} in table ${tableName} was expected to be required but the schema specified nullable`
      );
    }
  }
}

export const insert = mutation({
  args: {
    tableName: v.string(),
    document: v.any(),
  },
  handler: async (ctx, args) => {
    // TODO: split out into inserts per usecase and enforce unique constraints
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ctx.db.insert(args.tableName as any, args.document);
  },
  returns: v.null(),
});

export const batchInsert = mutation({
  args: {
    tableName: v.string(),
    records: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    await Promise.all(
      args.records.map(async (record) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await ctx.db.insert(args.tableName as any, record);
      })
    );
  },
  returns: v.null(),
});

export const loadSnapshot = query({
  args: {
    runId: v.string(),
    workflowName: v.string(),
  },
  handler: async (ctx, args) => {
    const snapshot = await ctx.db
      .query("snapshots")
      .withIndex("runId", (q) =>
        q.eq("runId", args.runId).eq("workflowName", args.workflowName)
      )
      .order("desc")
      .first();
    if (!snapshot) {
      return null;
    }
    const { _id, _creationTime, ...rest } = snapshot;
    return rest;
  },
});

export const load = query({
  args: {
    tableName: v.string(),
    keys: v.any(),
  },
  handler: async (ctx, args) => {
    if (args)
      throw new Error(
        `Not implemented: load for ${args.tableName}: ${JSON.stringify(args.keys)}`
      );
  },
  returns: v.union(v.any(), v.null()),
});

export const clearTable = action({
  args: { tableName: v.string() },
  handler: async (ctx, args) => {
    let cursor: string | null = null;
    while (true) {
      cursor = await ctx.scheduler.runAfter(
        0,
        internal.storage.storage.clearPage,
        {
          tableName: args.tableName,
          cursor,
        }
      );
      if (!cursor) {
        break;
      }
    }
  },
  returns: v.null(),
});

export const clearPage = internalMutation({
  args: { tableName: v.string(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args): Promise<string | null> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await ctx.db.query(args.tableName as any).paginate({
      numItems: 1000,
      cursor: args.cursor ?? null,
    });
    await Promise.all(
      page.page.map(async (item) => {
        await ctx.db.delete(item._id);
      })
    );
    if (!page.isDone) {
      return page.continueCursor;
    }
    return null;
  },
  returns: v.union(v.string(), v.null()),
});

export const getEvalsByAgentName = query({
  args: {
    agentName: v.string(),
    type: v.optional(v.union(v.literal("test"), v.literal("live"))),
  },
  handler: async (ctx, args) => {
    const evals = await ctx.db
      .query("evals")
      .withIndex("agentName", (q) => {
        const byAgent = q.eq("agentName", args.agentName);
        if (args.type === "test") {
          return byAgent.gt("testInfo.testPath", null);
        } else if (args.type === "live") {
          return byAgent.lte("testInfo.testPath", null);
        }
        return byAgent;
      })
      .collect();
    return evals.map((e) => {
      const { _id, _creationTime, ...serialized } = e;
      return serialized;
    });
  },
  returns: v.array(tables.evals.validator),
});

const MAX_TRACES_SCANNED = 4096;
export const getTracesPage = query({
  args: {
    name: v.optional(v.string()),
    scope: v.optional(v.string()),
    cursor: v.union(v.string(), v.null()),
    numItems: v.number(),
    attributes: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    const { scope, name, cursor, numItems, attributes } = args;
    const overfetch = (scope ? 1 : 8) * (name ? 1 : 8);
    const traces = paginator(ctx.db, schema).query("traces");
    const results = await (
      scope
        ? traces.withIndex("scope", (q) => q.eq("scope", scope))
        : name
          ? traces.withIndex("name", (q) =>
              q.gte("name", name).lt("name", name + "~")
            )
          : traces
    ).paginate({
      numItems: Math.min(numItems * overfetch, MAX_TRACES_SCANNED),
      cursor: cursor,
    });

    return {
      isDone: results.isDone,
      continuCursor: results.continueCursor,
      page: results.page
        .filter(
          (trace) =>
            (!name || trace.name.startsWith(name)) &&
            (!scope || trace.scope === scope) &&
            (!attributes ||
              Object.entries(attributes).every(
                ([key, value]) => trace[key as keyof typeof trace] === value
              ))
        )
        .map((t) => {
          const { _id, _creationTime, ...serialized } = t;
          return serialized;
        }),
    };
  },
  returns: v.object({
    isDone: v.boolean(),
    continuCursor: v.string(),
    page: v.array(tables.traces.validator),
  }),
});
