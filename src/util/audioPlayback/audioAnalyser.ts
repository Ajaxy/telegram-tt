import { IS_IOS } from '../browser/windowEnvironment';
import { onElementDestroy, peek } from './mediaPool';
import { getState, isCurrentElementPlaying } from './playbackController';

const FFT_SIZE = 2048;
const SMOOTHING = 0.85;

let audioContext: AudioContext | undefined;
const analyserByElement = new WeakMap<HTMLAudioElement, AnalyserNode>();
const sourceByElement = new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>();

export function ensureAudioContext() {
  if (IS_IOS) return;

  if (!audioContext) {
    audioContext = new AudioContext();
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
  // Inline videos are reused after release and keep their own audio output
  if (!element || element instanceof HTMLVideoElement) return undefined;

  let analyser = analyserByElement.get(element);
  if (!analyser) {
    const source = audioContext.createMediaElementSource(element);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING;
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    analyserByElement.set(element, analyser);
    sourceByElement.set(element, source);
  }

  return analyser;
}

onElementDestroy((element) => {
  const source = sourceByElement.get(element);
  const analyser = analyserByElement.get(element);
  if (!source || !analyser) return;

  source.disconnect();
  analyser.disconnect();
  sourceByElement.delete(element);
  analyserByElement.delete(element);
});
