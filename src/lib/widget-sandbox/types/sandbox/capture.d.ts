export declare const ID: unique symbol;
/**
 * Bumped by the mutations that can change which elements a live collection holds: an element
 * inserted or removed, a `class` attribute written. Reads (classList, dataset), styles, text and
 * flushes leave it alone, so a loop that reads or styles the items of a collection stays linear.
 */
export declare const domGeneration: () => number;
/** Switch the op stream to binary records (`binaryOps` feature); a no-op unless the glue installed `__hostOps`. */
export declare function enableBinaryOps(on: boolean): void;
export interface Hooks {
    /** A new element entered the mirror (first time the host hears about it). */
    elementCreated(el: any, id: number): void;
    attributeChanged(el: any, name: string, value: string | null): void;
    /** Extra ops for an element being synced (form control properties). */
    elementSynced(el: any, id: number, push: (op: any) => void, isNew: boolean): void;
    /** Called at the end of flush to append canvas command batches. */
    flushExtra(push: (op: any) => void): void;
}
export declare function setHooks(h: Hooks): void;
export declare function markDirty(node: any): void;
export declare function idOf(node: any): number;
export declare function nodeById(id: number): any;
/** Id of a node the host knows about, or 0. */
export declare function mirroredId(node: any): number;
export declare function hasPendingRecords(): boolean;
/** Queue a renderer-side property set (scrollTop, …) for an element. */
export declare function pushProp(node: any, name: string, value: string | number | boolean): void;
interface Observation {
    target: any;
    options: any;
}
declare class MutationObserverImpl {
    _cb: (records: any[], observer: any) => void;
    _obs: Observation[];
    _queue: any[];
    constructor(cb: (records: any[], observer: any) => void);
    observe(target: any, options?: any): void;
    disconnect(): void;
    takeRecords(): any[];
}
export { MutationObserverImpl as MutationObserver };
/** Deliver queued records. Returns true if any callback ran (it may have mutated the DOM). */
export declare function deliverMutationRecords(report: (e: unknown) => void): boolean;
/** Make sure the host knows a (possibly detached) element, e.g. an offscreen canvas. */
export declare function ensureCreated(node: any): number;
/**
 * Queue a renderer-side method call (scrollTo, setPointerCapture, …) for an
 * element. Methods outside the widget profile (focus, blur, scrollIntoView,
 * dialogs, popovers, text selection: docs/profile-v1.md) do nothing.
 */
export declare function callMethod(node: any, method: string, args?: unknown[]): void;
/** Emit ops for everything that changed since the last flush. */
export declare function flush(full?: boolean): void;
/** End-of-task flush, with the periodic full walk as a safety net. */
export declare function flushTick(): void;
export declare function collectPrototypes(samples: any[]): any[];
export declare function installDirtyTracking(protos: any[], tokenListProto: any): void;
