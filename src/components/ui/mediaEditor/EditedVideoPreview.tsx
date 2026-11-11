import {
  getIsHeavyAnimating, memo, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';

import type { MediaEditDocument } from '../../../types/mediaEditor';
import type { LayerFrames } from './render/layers';
import type { Size } from './render/transform';

import { VIDEO_TIME_PRECISION } from '../../../config';
import requestVideoFrame from '../../../util/requestVideoFrame';
import safePlay from '../../../util/safePlay';
import { composeFrame, createFrameScratch, disposeFrameScratch } from './render/composeFrame';
import { loadLayerFrames } from './render/layerFrames';
import { closeLayerFrames } from './render/layers';
import { fitCropToMaxSide } from './render/transform';
import loopVideoInTrim from './video/loopVideoInTrim';

import useHeavyAnimation from '../../../hooks/useHeavyAnimation';
import useLastCallback from '../../../hooks/useLastCallback';
import usePriorityPlaybackCheck, { isPriorityPlaybackActive } from '../../../hooks/usePriorityPlaybackCheck';
import useBackgroundMode, { isBackgroundModeActive } from '../../../hooks/window/useBackgroundMode';
import useDevicePixelRatio from '../../../hooks/window/useDevicePixelRatio';
import useMediaSource from './hooks/useMediaSource';

export type OwnProps = {
  blobUrl: string;
  mimeType: string;
  editDocument: MediaEditDocument;
  maxSide: number;
  className?: string;
  canPlay?: boolean;
  onReady?: (editDocument: MediaEditDocument) => void;
  onTimeUpdate?: (time: number) => void;
};

type LoadedLayerFrames = {
  video: HTMLVideoElement;
  layers: MediaEditDocument['layers'];
  size: Size;
  frames: LayerFrames;
};

type DrawnFrame = {
  editDocument: MediaEditDocument;
  size: Size;
};

const EditedVideoPreview = ({
  blobUrl,
  mimeType,
  editDocument,
  maxSide,
  className,
  canPlay,
  onReady,
  onTimeUpdate,
}: OwnProps) => {
  const canvasRef = useRef<HTMLCanvasElement>();
  const scratch = useMemo(createFrameScratch, []);
  const dpr = useDevicePixelRatio();
  const { crop, layers, trim } = editDocument;
  const trimStart = trim?.start ?? 0;
  const trimEnd = trim?.end;

  const { source } = useMediaSource(blobUrl, mimeType);
  const video = source?.kind === 'video' ? source.frame : undefined;
  const canvasSize = useMemo(() => fitCropToMaxSide(crop, Math.round(maxSide * dpr)), [crop, maxSide, dpr]);

  const [loadedLayerFrames, setLoadedLayerFrames] = useState<LoadedLayerFrames>();
  const layerFrames = loadedLayerFrames && loadedLayerFrames.video === video && loadedLayerFrames.layers === layers
    && loadedLayerFrames.size === canvasSize ? loadedLayerFrames.frames : undefined;
  const [drawnFrame, setDrawnFrame] = useState<DrawnFrame>();
  const isReady = drawnFrame?.editDocument === editDocument && drawnFrame.size === canvasSize;
  const shouldPlay = Boolean(isReady && canPlay);

  useEffect(() => () => disposeFrameScratch(scratch), [scratch]);

  useEffect(() => {
    if (!video) return undefined;

    let isCancelled = false;
    let frames: LayerFrames | undefined;
    void loadLayerFrames(layers, canvasSize, { shouldRenderText: true }).then((result) => {
      if (isCancelled) {
        closeLayerFrames(result);
        return;
      }

      frames = result;
      setLoadedLayerFrames({
        video, layers, size: canvasSize, frames: result,
      });
    });

    return () => {
      isCancelled = true;
      closeLayerFrames(frames);
    };
  }, [video, layers, canvasSize]);

  const draw = useLastCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !video || !source || !layerFrames) return;

    const { currentTime } = video;
    if (video.seeking || getIsOutsideTrim(currentTime, trimStart, trimEnd)) return;

    composeFrame({
      ctx,
      frame: video,
      sourceSize: source.size,
      doc: editDocument,
      scratch,
      layerFrames,
      time: Math.max(0, currentTime - trimStart),
    });
    onTimeUpdate?.(currentTime);

    if (!isReady) setDrawnFrame({ editDocument, size: canvasSize });
  });

  useLayoutEffect(() => {
    draw();
  }, [layerFrames, editDocument, canvasSize, draw]);

  useEffect(() => {
    if (!video) return undefined;

    video.addEventListener('seeked', draw);
    return () => video.removeEventListener('seeked', draw);
  }, [video, draw]);

  useEffect(() => {
    if (!video || !layerFrames) return undefined;

    let cancelFrame: NoneToVoidFunction | undefined;
    const drawNextFrame = () => {
      if (!video.paused) draw();
      cancelFrame = requestVideoFrame(video, drawNextFrame);
    };
    cancelFrame = requestVideoFrame(video, drawNextFrame);

    return () => cancelFrame?.();
  }, [video, layerFrames, draw]);

  useEffect(() => {
    if (!video) return undefined;

    video.loop = trimEnd === undefined;
    if (getIsOutsideTrim(video.currentTime, trimStart, trimEnd)) {
      video.currentTime = trimStart;
    }

    return trimEnd !== undefined ? loopVideoInTrim(video, trimStart, trimEnd) : undefined;
  }, [video, trimStart, trimEnd]);

  useEffect(() => {
    if (isReady) onReady?.(editDocument);
  }, [isReady, editDocument, onReady]);

  const pause = useLastCallback(() => {
    video?.pause();
  });

  const resume = useLastCallback(() => {
    if (!video || !shouldPlay || getIsHeavyAnimating() || isPriorityPlaybackActive() || isBackgroundModeActive()) {
      return;
    }

    safePlay(video);
  });

  useEffect(() => {
    if (shouldPlay) {
      resume();
    } else {
      pause();
    }
  }, [shouldPlay, resume, pause]);

  useHeavyAnimation(pause, resume, !shouldPlay);
  usePriorityPlaybackCheck(pause, resume, !shouldPlay);
  useBackgroundMode(pause, resume, !shouldPlay);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={canvasSize.width}
      height={canvasSize.height}
    />
  );
};

function getIsOutsideTrim(time: number, start: number, end?: number) {
  return time < start - VIDEO_TIME_PRECISION || (end !== undefined && time >= end);
}

export default memo(EditedVideoPreview);
