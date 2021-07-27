import {
  useCallback, useEffect, useRef, useState,
} from '../../../../lib/teact/teact';

import { IS_IOS, IS_VOICE_RECORDING_SUPPORTED } from '../../../../util/environment';
import * as voiceRecording from '../../../../util/voiceRecording';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';

type ActiveVoiceRecording = { stop: () => Promise<voiceRecording.Result>; pause: NoneToVoidFunction } | undefined;

export default () => {
  // eslint-disable-next-line no-null/no-null
  const recordButtonRef = useRef<HTMLButtonElement>(null);
  const [activeVoiceRecording, setActiveVoiceRecording] = useState<ActiveVoiceRecording>();
  const startRecordTimeRef = useRef<number>();
  const [currentRecordTime, setCurrentRecordTime] = useState<number | undefined>();

  useEffect(() => {
    // Preloading worker fixes silent first record on iOS
    if (IS_IOS && IS_VOICE_RECORDING_SUPPORTED) {
      void voiceRecording.init();
    }
  }, []);

  const startRecordingVoice = useCallback(async () => {
    try {
      const { stop, pause } = await voiceRecording.start((tickVolume: number) => {
        if (recordButtonRef.current) {
          if (startRecordTimeRef.current && Date.now() % 4 === 0) {
            recordButtonRef.current.style.boxShadow = `0 0 0 ${(tickVolume || 0) * 50}px rgba(0,0,0,.15)`;
          }
          setCurrentRecordTime(Date.now());
        }
      });
      startRecordTimeRef.current = Date.now();
      setCurrentRecordTime(Date.now());

      setActiveVoiceRecording({ stop, pause });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }, []);

  const pauseRecordingVoice = useCallback(() => {
    if (!activeVoiceRecording) {
      return undefined;
    }

    if (recordButtonRef.current) {
      recordButtonRef.current.style.boxShadow = 'none';
    }

    try {
      return activeVoiceRecording!.pause();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      return undefined;
    }
  }, [activeVoiceRecording]);

  const stopRecordingVoice = useCallback(() => {
    if (!activeVoiceRecording) {
      return undefined;
    }

    setActiveVoiceRecording(undefined);
    startRecordTimeRef.current = undefined;
    setCurrentRecordTime(undefined);
    if (recordButtonRef.current) {
      recordButtonRef.current.style.boxShadow = 'none';
    }
    try {
      return activeVoiceRecording!.stop();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      return undefined;
    }
  }, [activeVoiceRecording]);

  useEffect(() => {
    return activeVoiceRecording ? captureEscKeyListener(stopRecordingVoice) : undefined;
  }, [activeVoiceRecording, stopRecordingVoice]);

  return {
    startRecordingVoice,
    pauseRecordingVoice,
    stopRecordingVoice,
    activeVoiceRecording,
    currentRecordTime,
    recordButtonRef,
    startRecordTimeRef,
  };
};
