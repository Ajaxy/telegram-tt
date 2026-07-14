import type { IOpusRecorder } from 'opus-recorder';

import { checkIsNativeRecorderUsable } from './isNativeRecorderSupported';
import NativeVoiceRecorder from './nativeVoiceRecorder';
import WaveformAnalyser from './waveformAnalyser';

export type Result = { blob: Blob; duration: number; waveform: number[] };

export type ActiveRecording = {
  stop: (shouldSkipMinTime?: boolean) => Promise<Result>;
  pause: () => Promise<void>;
  resume: () => void;
  getSnapshot?: () => Uint8Array;
  getElapsedMs: () => number;
  getProfilePeaks: () => number[];
};

const MIN_RECORDING_TIME = 1000;
const BLOB_PARAMS = { type: 'audio/ogg' };
const FALLBACK_TAP_BUFFER_SIZE = 2048;

let fallbackInitPromise: Promise<void> | undefined;
let opusMediaRecorder: IOpusRecorder;

export async function init() {
  if (await checkIsNativeRecorderUsable()) {
    return undefined;
  }

  return initFallback();
}

export async function start(onPeak: (peak: number) => void): Promise<ActiveRecording> {
  return (await checkIsNativeRecorderUsable()) ? startNative(onPeak) : startFallback(onPeak);
}

function initFallback() {
  fallbackInitPromise ??= (async () => {
    try {
      const { default: OpusRecorder } = await import('opus-recorder');
      const encoderPath = (await import('opus-recorder/dist/encoderWorker.min.js?url')).default;
      opusMediaRecorder = new OpusRecorder({ encoderPath, reuseWorker: true });
    } catch (err) {
      // Drop failed initialization so the next attempt can retry
      fallbackInitPromise = undefined;
      throw err;
    }
  })();

  return fallbackInitPromise;
}

async function startNative(onPeak: (peak: number) => void): Promise<ActiveRecording> {
  const recorder = new NativeVoiceRecorder();
  const analyser = new WaveformAnalyser();
  analyser.onPeak = onPeak;
  recorder.onSamples = (samples) => analyser.pushSamples(samples);

  await recorder.start();

  const timekeeper = createTimekeeper();

  return {
    stop: async (shouldSkipMinTime?: boolean) => {
      if (!shouldSkipMinTime) {
        await waitForMinRecordingTime(timekeeper.getElapsedMs());
      }
      const ogg = await recorder.stop();
      if (!ogg.length) {
        throw new Error('Voice recording produced no data');
      }
      return {
        blob: new Blob([ogg.buffer as ArrayBuffer], BLOB_PARAMS),
        duration: Math.max(1, Math.round(timekeeper.getElapsedMs() / 1000)),
        waveform: Array.from(analyser.finish()),
      };
    },
    pause: async () => {
      if (timekeeper.getIsPaused()) return;
      timekeeper.pause();
      await recorder.pause();
    },
    resume: () => {
      if (!timekeeper.getIsPaused()) return;
      timekeeper.resume();
      recorder.resume();
    },
    getSnapshot: () => recorder.getSnapshot(),
    getElapsedMs: timekeeper.getElapsedMs,
    getProfilePeaks: () => analyser.getCurrentPeaks(),
  };
}

async function startFallback(onPeak: (peak: number) => void): Promise<ActiveRecording> {
  await initFallback();
  await opusMediaRecorder.start();

  const analyser = new WaveformAnalyser();
  analyser.onPeak = onPeak;

  const chunks: Uint8Array<ArrayBuffer>[] = [];
  opusMediaRecorder.ondataavailable = (typedArray) => {
    chunks.push(typedArray);
  };

  const timekeeper = createTimekeeper();

  const source = opusMediaRecorder.sourceNode;
  const scriptProcessor = source.context.createScriptProcessor(FALLBACK_TAP_BUFFER_SIZE, 1, 1);
  scriptProcessor.onaudioprocess = (e) => {
    if (timekeeper.getIsPaused()) return;
    analyser.pushSamples(e.inputBuffer.getChannelData(0));
  };
  source.connect(scriptProcessor);
  scriptProcessor.connect(source.context.destination);

  function releaseTap() {
    scriptProcessor.onaudioprocess = undefined as unknown as typeof scriptProcessor.onaudioprocess;
    try {
      source.disconnect(scriptProcessor);
    } catch (err) {
      // Already disconnected
    }
    scriptProcessor.disconnect();
  }

  return {
    stop: (shouldSkipMinTime?: boolean) => new Promise<Result>((resolve, reject) => {
      opusMediaRecorder.onstop = () => {
        resolve({
          blob: new Blob(chunks, BLOB_PARAMS),
          duration: Math.max(1, Math.round(timekeeper.getElapsedMs() / 1000)),
          waveform: Array.from(analyser.finish()),
        });
      };
      opusMediaRecorder.onerror = reject;

      const delay = shouldSkipMinTime ? Promise.resolve() : waitForMinRecordingTime(timekeeper.getElapsedMs());
      void delay.then(() => {
        opusMediaRecorder.stop();
        releaseTap();
      });
    }),
    pause: () => {
      if (timekeeper.getIsPaused()) return Promise.resolve();
      timekeeper.pause();
      opusMediaRecorder.pause();
      return Promise.resolve();
    },
    resume: () => {
      if (!timekeeper.getIsPaused()) return;
      timekeeper.resume();
      opusMediaRecorder.resume();
    },
    getElapsedMs: timekeeper.getElapsedMs,
    getProfilePeaks: () => analyser.getCurrentPeaks(),
  };
}

export function createTimekeeper() {
  const startedAt = Date.now();
  let intervalStartedAt = startedAt;
  let accumulatedMs = 0;
  let isPaused = false;

  return {
    pause: () => {
      accumulatedMs += Date.now() - intervalStartedAt;
      isPaused = true;
    },
    resume: () => {
      intervalStartedAt = Date.now();
      isPaused = false;
    },
    getElapsedMs: () => (isPaused ? accumulatedMs : accumulatedMs + (Date.now() - intervalStartedAt)),
    getIsPaused: () => isPaused,
  };
}

function waitForMinRecordingTime(elapsedMs: number) {
  const delay = Math.max(0, MIN_RECORDING_TIME - elapsedMs);
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delay);
  });
}
