import React, { memo, useRef } from '../../lib/teact/teact';

import useVideoAutoPause from '../middle/message/hooks/useVideoAutoPause';
import useVideoCleanup from '../../hooks/useVideoCleanup';

type OwnProps =
  {
    canPlay: boolean;
    ref?: React.RefObject<HTMLVideoElement>;
  }
  & React.DetailedHTMLProps<React.VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>;

function OptimizedVideo({
  ref,
  canPlay,
  ...restProps
}: OwnProps) {
  // eslint-disable-next-line no-null/no-null
  const localRef = useRef<HTMLVideoElement>(null);

  if (!ref) {
    ref = localRef;
  }

  const { handlePlaying } = useVideoAutoPause(ref, canPlay);
  useVideoCleanup(ref, []);

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <video ref={ref} autoPlay {...restProps} onPlaying={handlePlaying} />
  );
}

export default memo(OptimizedVideo);
