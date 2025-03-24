import { v } from "convex/values";
import { Doc } from "../_generated/dataModel.js";
import { mutation, query } from "../_generated/server.js";
import {
  type SerializedMessage,
  type SerializedThread,
  vSerializedMessage,
  vSerializedThread,
} from "../../mapping/storage.js";
import { paginator } from "convex-helpers/server/pagination";
import schema from "../schema.js";

function threadToSerializedMastra(thread: Doc<"threads">): SerializedThread {
  const { id, title, metadata, resourceId, createdAt, updatedAt } = thread;
  return { id, title, metadata, resourceId, createdAt, updatedAt };
}

export const getThreadById = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("id", (q) => q.eq("id", args.threadId))
      .unique();
    if (!thread) {
      return null;
    }
    return threadToSerializedMastra(thread);
  },
  returns: v.union(vSerializedThread, v.null()),
});

export const getThreadsByResourceId = query({
  args: {
    resourceId: v.string(),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    threads: SerializedThread[];
    continueCursor: string;
    isDone: boolean;
  }> => {
    const threads = await paginator(ctx.db, schema)
      .query("threads")
      .withIndex("resourceId", (q) => q.eq("resourceId", args.resourceId))
      .paginate({
        numItems: 100,
        cursor: args.cursor ?? null,
      });
    return {
      threads: threads.page.map(threadToSerializedMastra),
      continueCursor: threads.continueCursor,
      isDone: threads.isDone,
    };
  },
  returns: v.object({
    threads: v.array(vSerializedThread),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
});

export const saveThread = mutation({
  args: { thread: vSerializedThread },
  handler: async (ctx, args) => {
    await ctx.db.insert("threads", args.thread);
  },
  returns: v.null(),
});

export const updateThread = mutation({
  args: {
    threadId: v.string(),
    title: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("id", (q) => q.eq("id", args.threadId))
      .unique();
    if (!thread) {
      throw new Error(`Thread ${args.threadId} not found`);
    }
    if (args.title) {
      await ctx.db.patch(thread._id, {
        title: args.title,
        updatedAt: Date.now(),
      });
    }
    if (args.metadata) {
      await ctx.db.patch(thread._id, {
        metadata: args.metadata,
        updatedAt: Date.now(),
      });
    }
    return threadToSerializedMastra(thread);
  },
  returns: vSerializedThread,
});

export const deleteThread = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("threads")
      .withIndex("id", (q) => q.eq("id", args.threadId))
      .unique();
    if (!thread) {
      throw new Error(`Thread ${args.threadId} not found`);
    }
    await ctx.db.delete(thread._id);
  },
  returns: v.null(),
});

// const vMemoryConfig = v.object({
//   lastMessages: v.optional(v.union(v.number(), v.literal(false))),
//   semanticRecall: v.optional(
//     v.union(
//       v.boolean(),
//       v.object({
//         topK: v.number(),
//         messageRange: v.union(
//           v.number(),
//           v.object({ before: v.number(), after: v.number() }),
//         ),
//       }),
//     ),
//   ),
//   workingMemory: v.optional(
//     v.object({
//       enabled: v.boolean(),
//       template: v.optional(v.string()),
//       use: v.optional(
//         v.union(v.literal("text-stream"), v.literal("tool-call")),
//       ),
//     }),
//   ),
//   threads: v.optional(
//     v.object({
//       generateTitle: v.optional(v.boolean()),
//     }),
//   ),
// });
const vSelectBy = v.object({
  vectorSearchString: v.optional(v.string()),
  last: v.optional(v.union(v.number(), v.literal(false))),
  include: v.optional(
    v.array(
      v.object({
        id: v.string(),
        withPreviousMessages: v.optional(v.number()),
        withNextMessages: v.optional(v.number()),
      })
    )
  ),
});

function messageToSerializedMastra(
  message: Doc<"messages">
): SerializedMessage {
  const { threadOrder: _, _id, _creationTime, ...serialized } = message;
  return serialized;
}

const DEFAULT_MESSAGES_LIMIT = 40; // What pg & upstash do too.

export const getMessagesPage = query({
  args: {
    threadId: v.string(),
    selectBy: v.optional(vSelectBy),
    // Unimplemented and as far I can tell no storage provider has either.
    // memoryConfig: v.optional(vMemoryConfig),
  },
  handler: async (ctx, args): Promise<SerializedMessage[]> => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("threadId", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(args.selectBy?.last ? args.selectBy.last : DEFAULT_MESSAGES_LIMIT);

    const handled: boolean[] = [];
    const toFetch: number[] = [];
    for (const m of messages) {
      handled[m.threadOrder] = true;
    }
    await Promise.all(
      args.selectBy?.include?.map(async (range) => {
        const includeDoc = await ctx.db
          .query("messages")
          .withIndex("id", (q) => q.eq("id", range.id))
          .unique();
        if (!includeDoc) {
          console.warn(`Message ${range.id} not found`);
          return;
        }
        if (!range.withPreviousMessages && !range.withNextMessages) {
          messages.push(includeDoc);
          return;
        }
        const order = includeDoc.threadOrder;
        for (
          let i = order - (range.withPreviousMessages ?? 0);
          i < order + (range.withNextMessages ?? 0);
          i++
        ) {
          if (!handled[i]) {
            toFetch.push(i);
            handled[i] = true;
          }
        }
      }) ?? []
    );
    // sort and find unique numbers in toFetch
    const uniqueToFetch = [...new Set(toFetch)].sort();
    // find contiguous ranges in uniqueToFetch
    const ranges: { start: number; end: number }[] = [];
    for (let i = 0; i < uniqueToFetch.length; i++) {
      const start = uniqueToFetch[i];
      let end = start;
      while (i + 1 < uniqueToFetch.length && uniqueToFetch[i + 1] === end + 1) {
        end++;
        i++;
      }
      ranges.push({ start, end });
    }
    const fetched = (
      await Promise.all(
        ranges.map(async (range) => {
          return await ctx.db
            .query("messages")
            .withIndex("threadId", (q) =>
              q
                .eq("threadId", args.threadId)
                .gte("threadOrder", range.start)
                .lte("threadOrder", range.end)
            )
            .collect();
        })
      )
    ).flat();
    messages.push(...fetched);
    return messages.map(messageToSerializedMastra);
  },
  returns: v.array(vSerializedMessage),
});

export const saveMessages = mutation({
  args: { messages: v.array(vSerializedMessage) },
  handler: async (ctx, args) => {
    const messagesByThreadId: Record<string, SerializedMessage[]> = {};
    for (const message of args.messages) {
      messagesByThreadId[message.threadId] = [
        ...(messagesByThreadId[message.threadId] ?? []),
        message,
      ];
    }
    for (const threadId in messagesByThreadId) {
      const lastMessage = await ctx.db
        .query("messages")
        .withIndex("threadId", (q) => q.eq("threadId", threadId))
        .order("desc")
        .first();
      let threadOrder = lastMessage?.threadOrder ?? 0;
      for (const message of messagesByThreadId[threadId]) {
        threadOrder++;
        await ctx.db.insert("messages", {
          ...message,
          threadOrder,
        });
      }
    }
  },
  returns: v.null(),
});
