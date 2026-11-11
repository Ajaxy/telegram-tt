export type TaskKind = 'boot' | 'event' | 'lifecycle' | 'scripts' | 'visibility' | 'timer' | 'frame' | 'viewport' | 'resize' | 'theme' | 'bridge';
export interface CpuBudgetConfig {
    cpuLimitMs: number;
    cpuQuotaMs: number;
    cpuQuotaWindowMs: number;
    cpuKillAfterMs: number;
}
export type Decision = {
    run: true;
    sliceMs: number;
} | {
    run: false;
    retryAt: number;
};
export declare const BUCKETS = 10;
/** Kinds that may be postponed. `boot`, `event` and `visibility` always run. */
export declare const DEFERRABLE: ReadonlySet<string>;
/**
 * Events the page fires without input, which the widget can retrigger from their own listener (a `toggle` that flips
 * `open`, an `animationend` that restarts the animation): charged as `lifecycle`, so they wait for the quota (local patch, NOTICE.md).
 */
export declare const AUTONOMOUS_EVENTS: ReadonlySet<string>;
/** Layout queries the host may answer in one task (cached answers are free), whatever its slice (boot included). */
export declare const QUERY_LIMIT = 128;
/** What a task's layout queries may block the host in all: the hang guard behind the count. */
export declare const QUERY_BUDGET_MS = 1000;
/**
 * Whether a task with `queries` answered layout queries that blocked the host `queryMs` in all is past its limit, and
 * which: the host answers queries synchronously, so a forced-layout loop would hold the renderer hostage without ever
 * burning widget CPU; past either the task is interrupted and killed. The count stops the same widget on every device
 * (the time of a query does not: a cold first layout on a slow phone takes over 100 ms); their time also counts toward
 * the main-thread window, which slows the widget down instead.
 */
export declare function queryLimitHit(queries: number, queryMs: number): 'count' | 'time' | null;
/** The reason a task stopped by `queryLimitHit` is killed with. */
export declare function queryLimitReason(hit: 'count' | 'time', kind: string): string;
/** Modelled main-thread cost of one op the glue forwards to the validator, and of one canvas command in it. */
export declare const OP_COST_MS = 0.025;
export declare const CANVAS_COMMAND_COST_MS = 0.002;
/** What a batch of `ops` ops with `canvasCommands` canvas commands costs the host's main thread: deterministic, from what the widget sent. */
export declare function opsCostMs(ops: number, canvasCommands: number): number;
export declare class CpuBudget {
    private readonly cfg;
    private readonly bucketMs;
    private readonly buckets;
    /** Time spent past the quota, not in the window yet: at most one quota. */
    private debtMs;
    /** The last bucket the debt was settled at. */
    private settled;
    private throttledSince;
    private lastThrottleAt;
    constructor(cfg: CpuBudgetConfig);
    /** Bucket `b`'s slot, emptied when it still holds an older bucket. */
    private slot;
    /** Time in the window that ends with bucket `b` (the ten bucket slots cover exactly one window). */
    private windowAt;
    /** Moves the debt into the window, bucket by bucket since the last call, as the buckets that filled it leave. */
    private settle;
    /** Account `cpuMs` of widget JS time for a task that ended at `now`: into the window up to the quota, the rest is the debt. */
    record(_kind: TaskKind | string, cpuMs: number, now: number): void;
    /** JS time charged now: the window ending now plus the debt. */
    used(now: number): number;
    /** Before a task: run it with the whole slice for the interrupt handler, or retry at `retryAt`. */
    decide(kind: TaskKind | string, now: number): Decision;
    /** Length of the current uninterrupted throttling stretch (0 when not throttled). */
    throttledFor(now: number): number;
    /** `cpuKillAfterMs` (0 = never): kill the runtime once throttling has lasted this long. */
    shouldKill(now: number): boolean;
}
