/* eslint-disable no-console */

export const DEBUG_LEVELS = ['log', 'error', 'warn', 'info', 'debug'] as const;
export type DebugLevel = typeof DEBUG_LEVELS[number];
// @ts-ignore
const ORIGINAL_FUNCTIONS: Record<DebugLevel, (...args: any[]) => void> = DEBUG_LEVELS.reduce((acc, level) => {
  // @ts-ignore
  acc[level] = console[level];
  return acc;
}, {});

type DebugEntry = {
  level: DebugLevel;
  args: any[];
  date: Date;
};
let DEBUG_LOGS: DebugEntry[] = [];

export function logDebugMessage(level: DebugLevel, ...args: any[]) {
  DEBUG_LOGS.push({
    level,
    args,
    date: new Date(),
  });
  ORIGINAL_FUNCTIONS[level](...args);
}

export function initDebugConsole() {
  DEBUG_LOGS = [];
  DEBUG_LEVELS.forEach((level) => {
    // @ts-ignore
    console[level] = (...args: any[]) => {
      logDebugMessage(level, ...args);
    };
  });
}

export function disableDebugConsole() {
  DEBUG_LEVELS.forEach((level) => {
    // @ts-ignore
    console[level] = ORIGINAL_FUNCTIONS[level];
  });
  DEBUG_LOGS = [];
}

export function getDebugLogs() {
  return JSON.stringify(DEBUG_LOGS, (key, value) => (typeof value === 'bigint'
    ? value.toString()
    : value));
}
