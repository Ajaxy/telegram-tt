import React, { memo, useRef } from '../../lib/teact/teact';

import useLastCallback from '../../hooks/useLastCallback';
import useVideoAutoPause from '../middle/message/hooks/useVideoAutoPause';
import useVideoCleanup from '../../hooks/useVideoCleanup';
import useBuffering from '../../hooks/useBuffering';
import useSyncEffect from '../../hooks/useSyncEffect';

type OwnProps =
  {
    ref?: React.RefObject<HTMLVideoElement>;
    canPlay: boolean;
    onReady?: NoneToVoidFunction;
  }
  & React.DetailedHTMLProps<React.VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>;

function OptimizedVideo({
  ref,
  canPlay,
  onReady,
  onTimeUpdate,
  ...restProps
}: OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const localRef = useRef<HTMLVideoElement>(null);
  if (!ref) {
    ref = localRef;
  }

  const { handlePlaying: handlePlayingForAutoPause } = useVideoAutoPause(ref, canPlay);
  useVideoCleanup(ref, []);

  const isReadyRef = useRef(false);
  const handleReady = useLastCallback(() => {
    if (!isReadyRef.current) {
      onReady?.();
      isReadyRef.current = true;
    }
  });

  // This is only needed for browsers not allowing autoplay
  const { isBuffered, bufferingHandlers } = useBuffering(true, onTimeUpdate);
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
  });

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <video ref={ref} autoPlay {...restProps} {...otherBufferingHandlers} onPlaying={handlePlaying} />
  );
}

export default memo(OptimizedVideo);
