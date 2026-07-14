import { ENCODER_CONFIG } from './nativeVoiceRecorder';

let usablePromise: Promise<boolean> | undefined;

export function checkIsNativeRecorderUsable(): Promise<boolean> {
  usablePromise ??= (async () => {
    if (!isNativeRecorderSupported()) {
      return false;
    }

    try {
      const { supported } = await AudioEncoder.isConfigSupported(ENCODER_CONFIG);
      return Boolean(supported);
    } catch (err) {
      return false;
    }
  })();

  return usablePromise;
}

function isNativeRecorderSupported(): boolean {
  return typeof AudioEncoder !== 'undefined'
    && typeof AudioData !== 'undefined'
    && typeof AudioWorkletNode !== 'undefined'
    && typeof AudioContext !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia);
}
