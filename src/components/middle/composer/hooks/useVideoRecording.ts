import { useEffect, useRef, useState } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import { MAX_ROUND_VIDEO_RECORDING_DURATION } from '../../../../config';
import { createCallbackManager } from '../../../../util/callbacks';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import * as videoRecording from '../../../../util/videoRecording/videoRecording';

import useLastCallback from '../../../../hooks/useLastCallback';

type PeakListener = (peak: number) => void;

const useVideoRecording = () => {
  const { showNotification } = getActions();

  const [activeVideoRecording, setActiveVideoRecording] = useState<videoRecording.ActiveVideoRecording | undefined>();
  const [previewStream, setPreviewStream] = useState<MediaStream | undefined>();
  const [isVideoRecordingStarting, setIsVideoRecordingStarting] = useState(false);
  const [isVideoRecordingReady, setIsVideoRecordingReady] = useState(false);
  const [isVideoRecordingPaused, setIsVideoRecordingPaused] = useState(false);
  const [isRecordingFinished, setIsRecordingFinished] = useState(false);

  const activeRecordingRef = useRef<videoRecording.ActiveVideoRecording>();
  const resultPromiseRef = useRef<Promise<videoRecording.Result>>();
  const isStartingRef = useRef(false);
  const startTokenRef = useRef(0);
  const peakCallbacks = useRef(createCallbackManager<PeakListener>()).current;

  const clearRecordingState = useLastCallback(() => {
    activeRecordingRef.current?.destroyPlayback();
    activeRecordingRef.current = undefined;
    resultPromiseRef.current = undefined;
    setActiveVideoRecording(undefined);
    setPreviewStream(undefined);
    setIsVideoRecordingReady(false);
    setIsVideoRecordingPaused(false);
    setIsRecordingFinished(false);
  });

  const finishRecordingVideo = useLastCallback(() => {
    if (activeRecordingRef.current && !resultPromiseRef.current) {
      resultPromiseRef.current = activeRecordingRef.current.stop();
      setIsRecordingFinished(true);
    }
  });

  const startRecordingVideo = useLastCallback(async () => {
    if (isStartingRef.current || activeRecordingRef.current || resultPromiseRef.current) {
      return;
    }

    isStartingRef.current = true;
    startTokenRef.current += 1;
    const token = startTokenRef.current;
    setIsVideoRecordingStarting(true);

    try {
      const recording = await videoRecording.start((elapsedMs) => {
        if (startTokenRef.current !== token) {
          return;
        }

        if (elapsedMs >= MAX_ROUND_VIDEO_RECORDING_DURATION) {
          finishRecordingVideo();
        }
      }, (peak) => {
        if (startTokenRef.current !== token) {
          return;
        }

        peakCallbacks.runCallbacks(peak);
      });

      if (startTokenRef.current !== token) {
        recording.cancel();
        return;
      }

      activeRecordingRef.current = recording;
      setPreviewStream(recording.previewStream);
      setActiveVideoRecording(recording);
      setIsVideoRecordingReady(false);
      setIsVideoRecordingPaused(false);

      recording.whenReady.then(() => {
        if (startTokenRef.current !== token) return;
        setIsVideoRecordingReady(true);
      }, (err: unknown) => {
        if (startTokenRef.current !== token) return;
        showNotification({ message: { key: 'VideoMessageRecordError' } });
        // eslint-disable-next-line no-console
        console.error(err);
        clearRecordingState();
      });
    } catch (err) {
      if (startTokenRef.current !== token) {
        return;
      }

      const isPermissionDenied = err instanceof DOMException && err.name === 'NotAllowedError';
      showNotification({
        message: { key: isPermissionDenied ? 'VideoMessagePermissionDenied' : 'VideoMessageRecordError' },
      });
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      if (startTokenRef.current === token) {
        isStartingRef.current = false;
        setIsVideoRecordingStarting(false);
      }
    }
  });

  const pauseRecordingVideo = useLastCallback(async () => {
    const active = activeRecordingRef.current;
    if (!active || !isVideoRecordingReady || resultPromiseRef.current) return;

    try {
      await active.pause();
      setIsVideoRecordingPaused(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  });

  const resumeRecordingVideo = useLastCallback(() => {
    const active = activeRecordingRef.current;
    if (!active || resultPromiseRef.current) return;

    active.resume();
    setIsVideoRecordingPaused(false);
  });

  const stopRecordingVideo = useLastCallback(() => {
    startTokenRef.current += 1;
    const promise = resultPromiseRef.current ?? activeRecordingRef.current?.stop();
    clearRecordingState();

    if (!promise) {
      return undefined;
    }

    return promise.catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      return undefined;
    });
  });

  const discardRecordingVideo = useLastCallback(() => {
    startTokenRef.current += 1;
    const active = activeRecordingRef.current;
    const pendingResult = resultPromiseRef.current;
    isStartingRef.current = false;
    setIsVideoRecordingStarting(false);
    clearRecordingState();

    if (pendingResult) {
      pendingResult.catch(() => undefined);
    } else {
      active?.cancel();
    }
  });

  const getProgress = useLastCallback(() => {
    const active = activeRecordingRef.current;
    if (!active) {
      return 0;
    }

    return Math.min(1, active.getElapsedMs() / MAX_ROUND_VIDEO_RECORDING_DURATION);
  });

  const subscribeToVideoRecordingPeaks = useLastCallback((listener: PeakListener) => {
    return peakCallbacks.addCallback(listener);
  });

  useEffect(() => {
    return (activeVideoRecording || isVideoRecordingStarting)
      ? captureEscKeyListener(discardRecordingVideo)
      : undefined;
  }, [activeVideoRecording, isVideoRecordingStarting, discardRecordingVideo]);

  return {
    startRecordingVideo,
    stopRecordingVideo,
    finishRecordingVideo,
    discardRecordingVideo,
    pauseRecordingVideo,
    resumeRecordingVideo,
    activeVideoRecording,
    previewStream,
    isVideoRecordingStarting,
    isVideoRecordingReady,
    isVideoRecordingPaused,
    isRecordingFinished,
    getProgress,
    subscribeToVideoRecordingPeaks,
  };
};

export default useVideoRecording;
