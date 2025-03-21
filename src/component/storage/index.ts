import { v, Validator } from "convex/values";
import tables from "./tables.js";
import { internal } from "../_generated/api.js";
import { TableNames } from "./tables.js";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server.js";

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

export const insert = internalMutation({
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

export const batchInsert = internalMutation({
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

export const load = internalQuery({
  args: {
    tableName: v.string(),
    keys: v.any(),
  },
  handler: async (ctx, args) => {
    throw new Error(
      `Not implemented: load for ${args.tableName}: ${JSON.stringify(args.keys)}`
    );
  },
  returns: v.union(v.any(), v.null()),
});

export const clearTable = internalAction({
  args: { tableName: v.string() },
  handler: async (ctx, args) => {
    let cursor: string | null = null;
    while (true) {
      cursor = await ctx.scheduler.runAfter(
        0,
        internal.storage.index.clearPage,
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

export const getEvalsByAgentName = internalQuery({
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
export const getTracesPage = internalQuery({
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
    const results = await (
      scope
        ? ctx.db.query("traces").withIndex("scope", (q) => q.eq("scope", scope))
        : name
          ? ctx.db
              .query("traces")
              .withIndex("name", (q) =>
                q.gte("name", name).lt("name", name + "~")
              )
          : ctx.db.query("traces")
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
