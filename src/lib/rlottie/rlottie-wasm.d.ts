type RLottieWasmModule = {
  HEAPU8: Uint8Array;
  onRuntimeInitialized?: NoneToVoidFunction;
  cwrap: (ident: string, returnType: string, argTypes: string[]) => AnyFunction;
};

declare const Module: RLottieWasmModule;

export function allocate(slab: number[] | Uint8Array | number, types: string, allocator: number, ptr?: number): number;
export function intArrayFromString(str: string, noAddNull?: boolean, length?: number): number[];
export default Module;
