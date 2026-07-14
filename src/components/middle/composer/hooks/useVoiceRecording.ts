import { useEffect, useRef, useState } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import { IS_SAFARI, IS_VOICE_RECORDING_SUPPORTED } from '../../../../util/browser/windowEnvironment';
import { createCallbackManager } from '../../../../util/callbacks';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import * as voiceRecording from '../../../../util/voiceRecording';

import useLastCallback from '../../../../hooks/useLastCallback';

type PeakListener = (peak: number) => void;

const useVoiceRecording = () => {
  const recordButtonRef = useRef<HTMLButtonElement>();
  const [activeVoiceRecording, setActiveVoiceRecording] = useState<voiceRecording.ActiveRecording | undefined>();
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isViewOnceEnabled, setIsViewOnceEnabled] = useState(false);
  const peakCallbacks = useRef(createCallbackManager<PeakListener>()).current;

  useEffect(() => {
    if (IS_SAFARI && IS_VOICE_RECORDING_SUPPORTED) {
      void voiceRecording.init();
    }
  }, []);

  const startRecordingVoice = useLastCallback(async () => {
    try {
      const recording = await voiceRecording.start(peakCallbacks.runCallbacks);

      setIsRecordingPaused(false);
      setActiveVoiceRecording(recording);
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'NotFoundError')) {
        getActions().showNotification({ message: { key: 'VoiceRecordMicError' } });
        return;
      }
      // eslint-disable-next-line no-console
      console.error(err);
    }
  });

  const pauseRecordingVoice = useLastCallback(async () => {
    if (!activeVoiceRecording) return;

    try {
      await activeVoiceRecording.pause();
      setIsRecordingPaused(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  });

  const resumeRecordingVoice = useLastCallback(() => {
    if (!activeVoiceRecording) return;

    activeVoiceRecording.resume();
    setIsRecordingPaused(false);
  });

  const stopRecordingVoice = useLastCallback((shouldSkipMinTime?: boolean) => {
    if (!activeVoiceRecording) {
      return undefined;
    }

    setActiveVoiceRecording(undefined);
    setIsRecordingPaused(false);

    try {
      return activeVoiceRecording.stop(shouldSkipMinTime).catch((err): undefined => {
        // eslint-disable-next-line no-console
        console.error(err);
        return undefined;
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      return undefined;
    }
  });

  const cancelRecordingVoice = useLastCallback(() => {
    void stopRecordingVoice(true);
  });

  const toggleViewOnceEnabled = useLastCallback(() => {
    setIsViewOnceEnabled(!isViewOnceEnabled);
  });

  const subscribeToRecordingPeaks = useLastCallback((listener: PeakListener) => {
    return peakCallbacks.addCallback(listener);
  });

  useEffect(() => {
    return activeVoiceRecording ? captureEscKeyListener(cancelRecordingVoice) : undefined;
  }, [activeVoiceRecording, cancelRecordingVoice]);

  return {
    startRecordingVoice,
    pauseRecordingVoice,
    resumeRecordingVoice,
    stopRecordingVoice,
    cancelRecordingVoice,
    toggleViewOnceEnabled,
    subscribeToRecordingPeaks,
    activeVoiceRecording,
    isRecordingPaused,
    recordButtonRef,
    isViewOnceEnabled,
    setIsViewOnceEnabled,
  };
};

export default useVoiceRecording;
