import { type QuickJSWASMModule } from 'quickjs-emscripten-core';
/** The exports through which code runs in the VM, the only calls that may wait. */
export type RunExport = '_QTS_Call' | '_QTS_Eval' | '_QTS_ExecutePendingJob';
/** Whether this engine has JavaScript Promise Integration, which the runtime needs. */
export declare function hasJspi(): boolean;
type Settled = {
    value?: unknown;
    error?: unknown;
};
export declare class Suspender {
    /** Inside `run`: a host function may wait. */
    private running;
    private pending;
    private answer;
    private readonly promisingFns;
    /** Set once the instance exists: frees the value the first call of a waiting host call returned. */
    release: (ctx: number, ptr: number) => void;
    module: any;
    /** Whether a host function called now can wait: inside `run`, with no wait pending (not in `vm.dump()`, say). */
    canWait(): boolean;
    /** From a host function: answer this call with what `answer` settles to. False where nothing can wait. */
    wait(answer: Promise<unknown>): boolean;
    /** In the call made again after a wait: what the promise settled to (`error` when it was rejected). */
    takeAnswer(): Settled | null;
    /** Calls an export that runs code in the VM: a promise of its result. */
    run(name: RunExport, args: number[]): Promise<number>;
    /** Wraps the import QuickJS calls host functions through. */
    wrapHostCall(call: (...args: number[]) => number): unknown;
}
/** QuickJS from `wasmUrl` in `memory`, its host calls able to wait. */
export declare function instantiateSuspendable(wasmUrl: string, memory: WebAssembly.Memory): Promise<{
    QuickJS: QuickJSWASMModule;
    suspender: Suspender;
}>;
export {};
