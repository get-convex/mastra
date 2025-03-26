import { literals } from "convex-helpers/validators";
import {
  defineTable,
  GenericTableSearchIndexes,
  TableDefinition,
} from "convex/server";
import { GenericId, ObjectType, v, VId, VObject, VUnion } from "convex/values";

const embeddings = {
  id: v.optional(v.string()),
  indexName: v.string(),
  vector: v.array(v.number()),
  metadata: v.optional(v.record(v.string(), v.any())),
};

function table<D extends number>(dimensions: D): Table<D> {
  return defineTable(embeddings)
    .vectorIndex("vector", {
      vectorField: "vector",
      dimensions,
      filterFields: ["indexName"], // TODO: More fields
    })
    .index("id", ["id"]);
}

export const SUPPORTED_DIMENSIONS = [
  128, 256, 512, 768, 1024, 1536, 2048, 3072, 4096,
] as const;
export type SupportedDimension = (typeof SUPPORTED_DIMENSIONS)[number];
export const SUPPORTED_TABLE_NAMES = SUPPORTED_DIMENSIONS.map(
  (d) => `embeddings_${d}`
) as `embeddings_${(typeof SUPPORTED_DIMENSIONS)[number]}`[];
export type SupportedTableName = (typeof SUPPORTED_TABLE_NAMES)[number];
export const SUPPORTED_TABLE_ID = v.union(
  ...SUPPORTED_TABLE_NAMES.map((name) => v.id(name))
) as VUnion<
  GenericId<(typeof SUPPORTED_TABLE_NAMES)[number]>,
  VId<(typeof SUPPORTED_TABLE_NAMES)[number]>[]
>;

export const vSupportedDimension = literals(...SUPPORTED_DIMENSIONS);
export const vSupportedTableName = literals(...SUPPORTED_TABLE_NAMES);
export const vSupportedId = SUPPORTED_TABLE_ID;

type Table<D extends number> = TableDefinition<
  VObject<ObjectType<typeof embeddings>, typeof embeddings>,
  { id: ["id"] },
  GenericTableSearchIndexes,
  VectorIndex<D>
>;

type VectorIndex<D extends number> = {
  vector: {
    vectorField: "vector";
    dimensions: D;
    filterFields: string;
  };
};

const tables: {
  [K in keyof typeof SUPPORTED_DIMENSIONS &
    number as `embeddings_${(typeof SUPPORTED_DIMENSIONS)[K]}`]: Table<
    (typeof SUPPORTED_DIMENSIONS)[K]
  >;
} = Object.fromEntries(
  SUPPORTED_DIMENSIONS.map((dimensions) => [
    `embeddings_${dimensions}`,
    table(dimensions),
  ])
) as Record<
  `embeddings_${(typeof SUPPORTED_DIMENSIONS)[number]}`,
  Table<(typeof SUPPORTED_DIMENSIONS)[number]>
>;

// Hack to get vector indexes of arbitrary* dimensions
export default {
  ...tables,
  indexTableMap: defineTable({
    indexName: v.string(),
    tableName: vSupportedTableName,
    dimensions: vSupportedDimension,
  }).index("indexName", ["indexName"]),
  // documents: defineTable({
  //   id: v.string(),
  //   content: v.string(),
  // }).index("id", ["id"]),
};
