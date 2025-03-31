import { Infer, v } from "convex/values";
import { internalQuery, QueryCtx } from "./_generated/server";

export const DEFAULT_LOG_LEVEL: LogLevel = "INFO";

export const logLevel = v.union(
  v.literal("DEBUG"),
  v.literal("TRACE"),
  v.literal("INFO"),
  v.literal("REPORT"),
  v.literal("WARN"),
  v.literal("ERROR")
);
export type LogLevel = Infer<typeof logLevel>;

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Logger = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  time: (label: string) => void;
  timeEnd: (label: string) => void;
  event: (event: string, payload: Record<string, any>) => void;
  logLevel: LogLevel;
};
const logLevelOrder = logLevel.members.map((l) => l.value);
const logLevelByName = logLevelOrder.reduce(
  (acc, l, i) => {
    acc[l] = i;
    return acc;
  },
  {} as Record<LogLevel, number>
);
export function shouldLog(config: LogLevel, level: LogLevel) {
  return logLevelByName[config] <= logLevelByName[level];
}

const DEBUG = logLevelByName["DEBUG"];
const TRACE = logLevelByName["TRACE"];
const INFO = logLevelByName["INFO"];
const REPORT = logLevelByName["REPORT"];
const WARN = logLevelByName["WARN"];
const ERROR = logLevelByName["ERROR"];

export function createLogger(level: LogLevel | undefined): Logger {
  const logLevel = level ?? DEFAULT_LOG_LEVEL;
  const levelIndex = logLevelByName[logLevel];
  if (levelIndex === undefined) {
    throw new Error(`Invalid log level: ${level}`);
  }
  return {
    debug: (...args: unknown[]) => {
      if (levelIndex <= DEBUG) {
        console.debug(...args);
      }
    },
    info: (...args: unknown[]) => {
      if (levelIndex <= INFO) {
        console.info(...args);
      }
    },
    warn: (...args: unknown[]) => {
      if (levelIndex <= WARN) {
        console.warn(...args);
      }
    },
    error: (...args: unknown[]) => {
      if (levelIndex <= ERROR) {
        console.error(...args);
      }
    },
    time: (label: string) => {
      if (levelIndex <= TRACE) {
        console.time(label);
      }
    },
    timeEnd: (label: string) => {
      if (levelIndex <= TRACE) {
        console.timeEnd(label);
      }
    },
    event: (event: string, payload: Record<string, unknown>) => {
      const fullPayload = {
        component: "workpool",
        event,
        ...payload,
      };
      if (levelIndex === REPORT && event === "report") {
        console.info(JSON.stringify(fullPayload));
      } else if (levelIndex <= INFO) {
        console.info(JSON.stringify(fullPayload));
      }
    },
    logLevel,
  };
}

export async function makeConsole(ctx: QueryCtx) {
  const config = await ctx.db.query("config").first();
  const console = createLogger(config?.config.logLevel);
  return console;
}

export const getLogLevel = internalQuery({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db.query("config").first();
    return config?.config.logLevel ?? DEFAULT_LOG_LEVEL;
  },
  returns: logLevel,
});
