import { DEBUG } from '../../config';
import { createWorkerInterface } from '../../util/createPostMessageInterface';
import fasttextWasmPath from './fasttext.wasm?url';

interface FastTextExports {
  memory: WebAssembly.Memory;
  ft_input_ptr: () => number;
  ft_input_capacity: () => number;
  ft_detect: (length: number, threshold: number) => number;
  ft_label_ptr: () => number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Resolves to `undefined` on failure so that requests return no language instead of rejecting
const fastTextPromise = loadFastText().then((fastText) => {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[FASTTEXT] Worker ready');
  }

  return fastText;
}).catch((err) => {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.error('[FASTTEXT] Failed to load', err);
  }

  return undefined;
});

async function detectLanguage(text: string, threshold: number) {
  const fastText = await fastTextPromise;
  if (!fastText) return undefined;

  const { exports, input } = fastText;
  // Text past the capacity is ignored. `encodeInto` stops at a whole character.
  const labelLength = exports.ft_detect(encoder.encodeInto(text, input).written, threshold);
  if (!labelLength) return undefined;

  return decoder.decode(new Uint8Array(exports.memory.buffer, exports.ft_label_ptr(), labelLength));
}

async function loadFastText() {
  let result: WebAssembly.WebAssemblyInstantiatedSource;
  try {
    result = await WebAssembly.instantiateStreaming(fetch(fasttextWasmPath), {});
  } catch {
    // Fallback for servers not serving `application/wasm`
    const response = await fetch(fasttextWasmPath);
    result = await WebAssembly.instantiate(await response.arrayBuffer(), {});
  }

  const exports = result.instance.exports as unknown as FastTextExports;

  return {
    exports,
    // The engine has no allocator, so memory never grows and this view is never detached
    input: new Uint8Array(exports.memory.buffer, exports.ft_input_ptr(), exports.ft_input_capacity()),
  };
}

const api = {
  detectLanguage,
};

createWorkerInterface(api);

export type FastTextApi = typeof api;
