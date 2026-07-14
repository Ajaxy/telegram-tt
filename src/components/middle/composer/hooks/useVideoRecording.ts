import { useEffect, useRef, useState } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import { MAX_ROUND_VIDEO_RECORDING_DURATION } from '../../../../config';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import * as videoRecording from '../../../../util/videoRecording/videoRecording';

import useLastCallback from '../../../../hooks/useLastCallback';

const useVideoRecording = () => {
  const { showNotification } = getActions();

  const [activeVideoRecording, setActiveVideoRecording] = useState<videoRecording.ActiveVideoRecording | undefined>();
  const [previewStream, setPreviewStream] = useState<MediaStream | undefined>();
  const startRecordTimeRef = useRef<number>();
  const [currentRecordTime, setCurrentRecordTime] = useState<number | undefined>();
  const [isRecordingFinished, setIsRecordingFinished] = useState(false);

  const activeRecordingRef = useRef<videoRecording.ActiveVideoRecording>();
  const resultPromiseRef = useRef<Promise<videoRecording.Result>>();
  const isStartingRef = useRef(false);
  const startTokenRef = useRef(0);

  const clearRecordingState = useLastCallback(() => {
    activeRecordingRef.current = undefined;
    resultPromiseRef.current = undefined;
    startRecordTimeRef.current = undefined;
    setActiveVideoRecording(undefined);
    setPreviewStream(undefined);
    setCurrentRecordTime(undefined);
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

    try {
      const recording = await videoRecording.start((elapsedMs) => {
        if (startTokenRef.current !== token) {
          return;
        }

        if (startRecordTimeRef.current === undefined) {
          startRecordTimeRef.current = Date.now() - elapsedMs;
        }
        const maxMs = MAX_ROUND_VIDEO_RECORDING_DURATION;
        if (elapsedMs >= maxMs) {
          setCurrentRecordTime((startRecordTimeRef.current ?? Date.now()) + maxMs);
          finishRecordingVideo();
        } else {
          setCurrentRecordTime(Date.now());
        }
      });

      if (startTokenRef.current !== token) {
        recording.cancel();
        return;
      }

      activeRecordingRef.current = recording;
      setPreviewStream(recording.previewStream);
      setActiveVideoRecording(recording);
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
      isStartingRef.current = false;
    }
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
    clearRecordingState();

    if (pendingResult) {
      pendingResult.catch(() => undefined);
    } else {
      active?.cancel();
    }
  });

  const getProgress = useLastCallback(() => {
    if (!startRecordTimeRef.current) {
      return 0;
    }

    const elapsed = Date.now() - startRecordTimeRef.current;
    return Math.min(1, elapsed / MAX_ROUND_VIDEO_RECORDING_DURATION);
  });

  useEffect(() => {
    return activeVideoRecording ? captureEscKeyListener(discardRecordingVideo) : undefined;
  }, [activeVideoRecording, discardRecordingVideo]);

  return {
    startRecordingVideo,
    stopRecordingVideo,
    finishRecordingVideo,
    discardRecordingVideo,
    activeVideoRecording,
    previewStream,
    currentRecordTime,
    startRecordTimeRef,
    getProgress,
    isRecordingFinished,
  };
};

export default useVideoRecording;
