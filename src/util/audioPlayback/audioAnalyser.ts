import { IS_IOS } from '../browser/windowEnvironment';
import { onElementDestroy, peek } from './mediaPool';
import { getState, isCurrentElementPlaying } from './playbackController';

const FFT_SIZE = 2048;
const SMOOTHING = 0.85;

let audioContext: AudioContext | undefined;
const analyserByElement = new WeakMap<HTMLAudioElement, AnalyserNode>();
const sourceByElement = new WeakMap<HTMLAudioElement, MediaStreamAudioSourceNode>();
const streamByElement = new WeakMap<HTMLAudioElement, MediaStream>();

function canCaptureStream(element: HTMLAudioElement): element is HTMLAudioElement & {
  captureStream(): MediaStream;
} {
  return typeof (element as HTMLAudioElement & { captureStream?: () => MediaStream }).captureStream === 'function'
  || typeof (element as HTMLAudioElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream === 'function';
}

function captureElementStream(element: HTMLAudioElement): MediaStream | undefined {
  const el = element as HTMLAudioElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };
  try {
    if (typeof el.captureStream === 'function') {
      return el.captureStream();
    }
    if (typeof el.mozCaptureStream === 'function') {
      return el.mozCaptureStream();
    }
  } catch {
  }
  return undefined;
}

export function ensureAudioContext() {
  if (IS_IOS) return;

  if (!audioContext) {
    audioContext = new AudioContext({ latencyHint: 'playback' });
    audioContext.onstatechange = () => {
      if (audioContext!.state === 'suspended' && isCurrentElementPlaying()) {
        void audioContext!.resume();
      }
    };
  }

  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }
}

export function getCurrentTrackAnalyser() {
  if (!audioContext || audioContext.state !== 'running') return undefined;

  const { trackKey } = getState();
  if (!trackKey) return undefined;

  const element = peek(trackKey);
  if (!element || !canCaptureStream(element)) return undefined;

  let analyser = analyserByElement.get(element);
  if (!analyser) {
    const stream = captureElementStream(element);
    if (!stream || stream.getAudioTracks().length === 0) return undefined;
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING;
    source.connect(analyser);
    analyserByElement.set(element, analyser);
    sourceByElement.set(element, source);
    streamByElement.set(element, stream);
  }

  return analyser;
}

onElementDestroy((element) => {
  const source = sourceByElement.get(element);
  const analyser = analyserByElement.get(element);
  const stream = streamByElement.get(element);

  if (source) {
    source.disconnect();
    sourceByElement.delete(element);
  }
  if (analyser) {
    analyser.disconnect();
    analyserByElement.delete(element);
  }
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    streamByElement.delete(element);
  }
});
