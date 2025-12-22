import { DEBUG } from '../../config';
import { createWorkerInterface } from '../../util/createPostMessageInterface';
import fasttextInitializer from './fasttext-wasm.cjs';
import fasttextWasmPath from './fasttext-wasm.wasm';

type FastTextMethods = {
  makePrediction: (type: 'predict' | 'predict-prob', text: string, k: string, threshold: string) => Promise<string>;
};

const LABEL_PREFIX = '__label__';

// Since webpack will change the name and potentially the path of the
// `.wasm` file, we have to provide a `locateFile()` hook to redirect
// to the appropriate URL.
// More details: https://kripken.github.io/emscripten-site/docs/api_reference/module.html
let fastTextInstance: FastTextMethods;
const fastTextPromise = fasttextInitializer({
  locateFile: (path: string, prefix: string) => {
    if (path.endsWith('.wasm')) {
      return fasttextWasmPath;
    }
    return prefix + path;
  },
}).then((fastText: FastTextMethods) => {
  fastTextInstance = fastText;
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[FASTTEXT] Worker ready');
  }
});

function parseLabel(label: string) {
  return label.split('\n')[0].replace(LABEL_PREFIX, '').trim();
}

function parseLabelsWithProbabilities(labels: string) {
  return labels.trim()
    .split('\n')
    .map((labelWithProb: string) => {
      const [label, prob] = labelWithProb.split(' ');
      return {
        detectedLanguage: parseLabel(label),
        confidence: parseFloat(prob),
      };
    });
}

export async function detectLanguage(text: string, threshold: number) {
  if (!fastTextInstance) await fastTextPromise;
  const label = await fastTextInstance.makePrediction('predict', text, '1', threshold.toString());
  if (!label.length) return undefined;
  return parseLabel(label);
}

export async function detectLanguageProbability(text: string, labelsCount: number, threshold: number) {
  if (!fastTextInstance) await fastTextPromise;
  const labels = await fastTextInstance.makePrediction(
    'predict-prob', text, labelsCount.toString(), threshold.toString(),
  );
  if (!labels.length) return undefined;
  return parseLabelsWithProbabilities(labels);
}

const api = {
  detectLanguage,
  detectLanguageProbability,
};

createWorkerInterface(api);

export type FastTextApi = typeof api;
