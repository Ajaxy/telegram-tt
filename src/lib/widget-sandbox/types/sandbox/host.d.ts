/** Optional binary channel for canvas command words (docs/protocol.md, "Canvas words"); only when the glue installs it. */
export declare const hostCanvas: ((key: number, words: Float64Array, strings: string) => void) | null;
/** Optional binary channel for DOM ops (docs/protocol.md, "Binary DOM ops"); only when the glue installs it. */
export declare const hostOps: ((words: Int32Array, strings: string) => void) | null;
/** Queue a canvas word payload for the next ops batch; its index is the `bin` of the placeholder op. */
export declare function stageCanvas(words: Float64Array, strings: string): number;
export declare function stagedCanvasCount(): number;
/** Hands the staged payloads to the glue; called right before the `ops` batch that refers to them. */
export declare function sendStagedCanvas(): void;
export declare const host: (kind: string, arg?: string) => any;
export declare const hostBinary: () => ArrayBuffer | null;
export declare function diag(kind: string, detail: string): void;
/** Record (once per API) that the widget touched something the runtime does not provide. */
export declare function unsupported(api: string): void;
export declare const counters: {
    cacheHits: number;
    missed: number;
};
export declare function setFlushHook(fn: () => void): void;
/** Layout may have changed: drop cached answers. Called after every flush that sent ops. */
export declare function invalidateLayout(keepBoxes?: boolean): void;
/**
 * Synchronous round trip to the renderer. Pending mutations are flushed first so
 * the answer reflects the current DOM; answers are cached until the next flush.
 */
export declare function query(q: Record<string, unknown>, cacheable?: boolean): any;
