import { type SandboxConfig, type WorkerToHost } from '../shared/protocol';
export interface PooledWorker {
    worker: Worker;
    /** Resolves when the bundle is evaluated (or rejects if the worker died first). */
    warmed: Promise<number>;
    /** Everything the worker said while idle in the pool (the shim's document skeleton ops, diagnostics): the host replays it before anything else. */
    pending: WorkerToHost[];
}
export interface WorkerPoolOptions {
    /** Limits the warmed VM boots with (the real config comes with `start`); defaults to LIMIT_DEFAULTS. */
    limits?: Partial<Pick<SandboxConfig, 'memoryLimitBytes' | 'cpuLimitMs'>>;
    /** Return false to postpone refilling (e.g. while the feed is scrolling); `refill()` resumes it. */
    canRefill?: () => boolean;
}
export declare class WorkerPool {
    readonly size: number;
    private opts;
    private idle;
    private destroyed;
    /** Counters for the demo / bench. */
    readonly stats: {
        created: number;
        hits: number;
        misses: number;
    };
    constructor(size: number, opts?: WorkerPoolOptions);
    /** Fill the pool and wait until every worker is warm (app start). */
    prewarm(): Promise<void>;
    /** A warmed worker (or a fresh one when the pool is empty: it still boots, just later than it could have). */
    take(): PooledWorker;
    /** Top the pool up to `size` (no-op while `canRefill` says no). */
    refill(): void;
    get warm(): number;
    destroy(): void;
    private create;
}
