import { useEffect, useRef, useState } from '../../../../lib/teact/teact';

import { requestMutation } from '../../../../lib/fasterdom/fasterdom';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import * as voiceRecording from '../../../../util/voiceRecording';
import { IS_SAFARI, IS_VOICE_RECORDING_SUPPORTED } from '../../../../util/windowEnvironment';

import useLastCallback from '../../../../hooks/useLastCallback';

type ActiveVoiceRecording =
  { stop: () => Promise<voiceRecording.Result>; pause: NoneToVoidFunction }
  | undefined;

const useVoiceRecording = () => {
  // eslint-disable-next-line no-null/no-null
  const recordButtonRef = useRef<HTMLButtonElement>(null);
  const [activeVoiceRecording, setActiveVoiceRecording] = useState<ActiveVoiceRecording>();
  const startRecordTimeRef = useRef<number>();
  const [currentRecordTime, setCurrentRecordTime] = useState<number | undefined>();
  const [isViewOnceEnabled, setIsViewOnceEnabled] = useState(false);

  useEffect(() => {
    // Preloading worker fixes silent first record on iOS
    if (IS_SAFARI && IS_VOICE_RECORDING_SUPPORTED) {
      void voiceRecording.init();
    }
  }, []);

  const startRecordingVoice = useLastCallback(async () => {
    try {
      const { stop, pause } = await voiceRecording.start((tickVolume: number) => {
        if (recordButtonRef.current) {
          if (startRecordTimeRef.current && Date.now() % 4 === 0) {
            requestMutation(() => {
              if (!recordButtonRef.current) return;
              recordButtonRef.current.style.boxShadow = `0 0 0 ${(tickVolume || 0) * 50}px rgba(0,0,0,.15)`;
            });
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
  });

  const pauseRecordingVoice = useLastCallback(() => {
    if (!activeVoiceRecording) {
      return undefined;
    }

    requestMutation(() => {
      if (recordButtonRef.current) {
        recordButtonRef.current!.style.boxShadow = 'none';
      }
    });

    try {
      return activeVoiceRecording!.pause();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      return undefined;
    }
  });

  const stopRecordingVoice = useLastCallback(() => {
    if (!activeVoiceRecording) {
      return undefined;
    }

    setActiveVoiceRecording(undefined);
    startRecordTimeRef.current = undefined;
    setCurrentRecordTime(undefined);

    requestMutation(() => {
      if (recordButtonRef.current) {
        recordButtonRef.current.style.boxShadow = 'none';
      }
    });

    try {
      return activeVoiceRecording!.stop();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      return undefined;
    }
  });

  useEffect(() => {
    return activeVoiceRecording ? captureEscKeyListener(stopRecordingVoice) : undefined;
  }, [activeVoiceRecording, stopRecordingVoice]);

  const toogleViewOnceEnabled = useLastCallback(() => {
    setIsViewOnceEnabled(!isViewOnceEnabled);
  });

  return {
    startRecordingVoice,
    pauseRecordingVoice,
    stopRecordingVoice,
    activeVoiceRecording,
    currentRecordTime,
    recordButtonRef,
    startRecordTimeRef,
    isViewOnceEnabled,
    setIsViewOnceEnabled,
    toogleViewOnceEnabled,
  };
};

export default useVoiceRecording;
