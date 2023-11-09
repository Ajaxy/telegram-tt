import React, { memo, useMemo, useRef } from 'react';

import useBuffering from '../../hooks/useBuffering.react';
import useLastCallback from '../../hooks/useLastCallback.react';
import useSyncEffect from '../../hooks/useSyncEffect.react';
import useVideoCleanup from '../../hooks/useVideoCleanup.react';
import useVideoAutoPause from '../middle/message/hooks/useVideoAutoPause.react';

type VideoProps = React.DetailedHTMLProps<React.VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>;

type OwnProps =
  {
    ref?: React.RefObject<HTMLVideoElement>;
    isPriority?: boolean;
    canPlay: boolean;
    children?: React.ReactNode;
    onReady?: NoneToVoidFunction;
    onBroken?: NoneToVoidFunction;
  }
  & VideoProps;

function OptimizedVideo({
  ref,
  isPriority,
  canPlay,
  children,
  onReady,
  onBroken,
  onTimeUpdate,
  ...restProps
}: OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const localRef = useRef<HTMLVideoElement>(null);
  if (!ref) {
    ref = localRef;
  }

  const { handlePlaying: handlePlayingForAutoPause } = useVideoAutoPause(ref, canPlay, isPriority);
  useVideoCleanup(ref, []);

  const isReadyRef = useRef(false);
  const handleReady = useLastCallback(() => {
    if (!isReadyRef.current) {
      onReady?.();
      isReadyRef.current = true;
    }
  });

  // This is only needed for browsers not allowing autoplay
  const { isBuffered, bufferingHandlers } = useBuffering(true, onTimeUpdate, onBroken);
  const { onPlaying: handlePlayingForBuffering, ...otherBufferingHandlers } = bufferingHandlers;
  useSyncEffect(([prevIsBuffered]) => {
    if (prevIsBuffered === undefined) {
      return;
    }

    handleReady();
  }, [isBuffered, handleReady]);

  const handlePlaying = useLastCallback((e) => {
    handlePlayingForAutoPause();
    handlePlayingForBuffering(e);
    handleReady();
    restProps.onPlaying?.(e);
  });

  const mergedOtherBufferingHandlers = useMemo(() => {
    const mergedHandlers: Record<string, AnyFunction> = {};
    Object.keys(otherBufferingHandlers).forEach((keyString) => {
      const key = keyString as keyof typeof otherBufferingHandlers;
      mergedHandlers[key] = (event: Event) => {
        restProps[key as keyof typeof restProps]?.(event);
        otherBufferingHandlers[key]?.(event);
      };
    });

    return mergedHandlers;
  }, [otherBufferingHandlers, restProps]);

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <video ref={ref} autoPlay {...restProps} {...mergedOtherBufferingHandlers} onPlaying={handlePlaying}>
      {children}
    </video>
  );
}

export default memo(OptimizedVideo);
