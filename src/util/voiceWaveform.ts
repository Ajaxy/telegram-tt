import { onFullyIdle } from '../lib/teact/teact';

import type { ApiVoice } from '../api/types';
import { ApiMediaFormat } from '../api/types';

import { getMediaHash } from '../global/helpers';
import WaveformAnalyser from './voiceRecording/waveformAnalyser';
import { fetchBlob } from './files';
import * as mediaLoader from './mediaLoader';

import LimitedMap from './primitives/LimitedMap';

// The whole audio is decoded into memory, so longer voices keep the empty waveform
export const MAX_GENERATED_WAVEFORM_DURATION = 10 * 60;
// Duration is sender-declared, so the file size is capped too
export const MAX_GENERATED_WAVEFORM_SIZE = 4 * 1024 * 1024;
// Peaks survive downsampling well, and decoding at a low rate keeps the buffer small
const DECODE_SAMPLE_RATE = 8000;
const CACHE_LIMIT = 500;

const waveformCache = new LimitedMap<string, number[] | undefined>(CACHE_LIMIT);
const pendingWaveforms = new Map<string, Promise<number[] | undefined>>();
const requestCountsById = new Map<string, number>();
// Every request downloads and decodes a whole file, so requests run strictly one at a time, and only when idle
let waveformQueue: Promise<unknown> = Promise.resolve();

export function getGeneratedVoiceWaveform(voice: ApiVoice) {
  return waveformCache.get(voice.id);
}

// Subscribers are counted so that requests queued for unmounted components are dropped
export function retainVoiceWaveformRequest(id: string) {
  requestCountsById.set(id, (requestCountsById.get(id) || 0) + 1);
}

export function releaseVoiceWaveformRequest(id: string) {
  const count = requestCountsById.get(id) || 0;
  if (count > 1) {
    requestCountsById.set(id, count - 1);
  } else {
    requestCountsById.delete(id);
  }
}

export function generateVoiceWaveform(voice: ApiVoice) {
  const { id } = voice;
  if (waveformCache.has(id)) {
    return Promise.resolve(waveformCache.get(id));
  }

  let pending = pendingWaveforms.get(id);
  if (!pending) {
    pending = waveformQueue.then(() => processWaveformRequest(voice));
    pendingWaveforms.set(id, pending);
    waveformQueue = pending;
  }

  return pending;
}

async function processWaveformRequest(voice: ApiVoice) {
  const { id } = voice;
  await waitForFullyIdle();

  if (!requestCountsById.has(id)) {
    pendingWaveforms.delete(id);
    return undefined;
  }

  const waveform = await buildWaveformFromAudio(voice).catch(() => undefined);
  waveformCache.set(id, waveform);
  pendingWaveforms.delete(id);
  return waveform;
}

async function buildWaveformFromAudio(voice: ApiVoice) {
  const blobUrl = await mediaLoader.fetch(getMediaHash(voice, 'inline')!, ApiMediaFormat.BlobUrl);
  if (!blobUrl) {
    return undefined;
  }

  const blob = await fetchBlob(blobUrl);
  const audioContext = new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE);
  const audioBuffer = await audioContext.decodeAudioData(await blob.arrayBuffer());

  // Analysis is synchronous, so it waits out any animation started while decoding
  await waitForFullyIdle();

  const analyser = new WaveformAnalyser();
  analyser.pushSamples(audioBuffer.getChannelData(0));

  return Array.from(analyser.finish());
}

function waitForFullyIdle() {
  return new Promise<void>((resolve) => {
    onFullyIdle(resolve);
  });
}
