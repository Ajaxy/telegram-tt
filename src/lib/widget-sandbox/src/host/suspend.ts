// QuickJS whose host calls can wait for an answer that comes later (a layout query the page answers), while the
// widget's code stays synchronous: the page needs no cross-origin isolation for a SharedArrayBuffer (local patch,
// NOTICE.md). With JavaScript Promise Integration the host call import is `WebAssembly.Suspending` and the exports
// that run code are `WebAssembly.promising`.
//
// A host call that waits is made twice: the first time the host function hands over a promise (`wait`) and returns
// nothing; once it settles the same call is made again and the host function takes the answer (`takeAnswer`).
// Nothing else runs in the instance meanwhile.

import { newQuickJSWASMModuleFromVariant, newVariant, type QuickJSWASMModule } from 'quickjs-emscripten-core';
import baseVariant from '../../quickjs/prebuilt/index.mjs';

/** The exports through which code runs in the VM, the only calls that may wait. */
export type RunExport = '_QTS_Call' | '_QTS_Eval' | '_QTS_ExecutePendingJob';

const W = WebAssembly as typeof WebAssembly & {
  Suspending?: new (fn: (...args: any[]) => unknown) => unknown;
  promising?: (fn: Function) => (...args: unknown[]) => Promise<number>;
};

/** Whether this engine has JavaScript Promise Integration, which the runtime needs. */
export function hasJspi(): boolean {
  return typeof W.Suspending === 'function' && typeof W.promising === 'function';
}

type Settled = { value?: unknown; error?: unknown };

export class Suspender {
  /** Inside `run`: a host function may wait. */
  private running = false;
  private pending: Promise<unknown> | null = null;
  private answer: Settled | null = null;
  private readonly promisingFns = new Map<RunExport, (...args: unknown[]) => Promise<number>>();
  /** Set once the instance exists: frees the value the first call of a waiting host call returned. */
  release: (ctx: number, ptr: number) => void = () => {};
  module: any = null;

  /** Whether a host function called now can wait: inside `run`, with no wait pending (not in `vm.dump()`, say). */
  canWait(): boolean {
    return this.running && !this.pending;
  }

  /** From a host function: answer this call with what `answer` settles to. False where nothing can wait. */
  wait(answer: Promise<unknown>): boolean {
    if (!this.canWait()) return false;
    this.pending = answer;
    return true;
  }

  /** In the call made again after a wait: what the promise settled to (`error` when it was rejected). */
  takeAnswer(): Settled | null {
    const answer = this.answer;
    this.answer = null;
    return answer;
  }

  /** Calls an export that runs code in the VM: a promise of its result. */
  run(name: RunExport, args: number[]): Promise<number> {
    let promising = this.promisingFns.get(name);
    if (!promising) this.promisingFns.set(name, promising = W.promising!(this.module[name]));
    this.running = true;
    const result = promising(...args);
    const ran = () => { this.running = false; };
    result.then(ran, ran);
    return result;
  }

  /** Wraps the import QuickJS calls host functions through. */
  wrapHostCall(call: (...args: number[]) => number): unknown {
    const suspender = this;
    return new W.Suspending!(function (this: unknown, ...args: number[]) {
      const result = call.apply(this, args);
      const pending = suspender.pending;
      if (!pending) return result;
      suspender.pending = null;
      // what the first call returned is never used
      suspender.release(args[0], result);
      // the second call, with the answer
      const again = (settled: Settled) => {
        suspender.answer = settled;
        return call.apply(this, args);
      };
      return pending.then((value) => again({ value }), (error) => again({ error: error ?? new Error('rejected') }));
    });
  }
}

/** The emscripten import QuickJS calls host functions through (its name is minified: found by what it does). */
function findHostCallImport(imports: WebAssembly.Imports): [string, string] {
  for (const [moduleName, entries] of Object.entries(imports)) {
    for (const [name, value] of Object.entries(entries)) {
      if (typeof value === 'function' && String(value).includes('callbacks.callFunction')) return [moduleName, name];
    }
  }
  throw new Error('the QuickJS host call import was not found');
}

/** QuickJS from `wasmUrl` in `memory`, its host calls able to wait. */
export async function instantiateSuspendable(wasmUrl: string, memory: WebAssembly.Memory): Promise<{ QuickJS: QuickJSWASMModule; suspender: Suspender }> {
  const suspender = new Suspender();
  const variant = newVariant(baseVariant, {
    wasmMemory: memory,
    emscriptenModule: {
      instantiateWasm: async (imports: WebAssembly.Imports, onSuccess: (instance: WebAssembly.Instance) => void) => {
        const [moduleName, name] = findHostCallImport(imports);
        const entries = imports[moduleName] as Record<string, unknown>;
        entries[name] = suspender.wrapHostCall(entries[name] as (...args: number[]) => number);
        const response = await fetch(wasmUrl);
        if (!response.ok) throw new Error(`QuickJS: HTTP ${response.status}`);
        const { instance } = await WebAssembly.instantiate(await response.arrayBuffer(), imports);
        onSuccess(instance);
        return instance.exports;
      },
    } as any,
  });
  const QuickJS = await newQuickJSWASMModuleFromVariant(variant);
  const q = QuickJS as any;
  suspender.module = q.module;
  suspender.release = (ctx, ptr) => { if (ptr) q.ffi.QTS_FreeValuePointer(ctx, ptr); };
  return { QuickJS, suspender };
}
