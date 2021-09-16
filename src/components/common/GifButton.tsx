import React, {
  FC, memo, useCallback, useRef,
} from '../../lib/teact/teact';

import { ApiMediaFormat, ApiVideo } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { ObserveFn, useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useMedia from '../../hooks/useMedia';
import useVideoCleanup from '../../hooks/useVideoCleanup';
import useBuffering from '../../hooks/useBuffering';
import useCanvasBlur from '../../hooks/useCanvasBlur';
import { preventMessageInputBlurWithBubbling } from '../middle/helpers/preventMessageInputBlur';

import Spinner from '../ui/Spinner';

import './GifButton.scss';

type OwnProps = {
  gif: ApiVideo;
  observeIntersection: ObserveFn;
  isDisabled?: boolean;
  className?: string;
  onClick: (gif: ApiVideo) => void;
};

const GifButton: FC<OwnProps> = ({
  gif, observeIntersection, isDisabled, className, onClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const videoRef = useRef<HTMLVideoElement>(null);

  const hasThumbnail = Boolean(gif.thumbnail?.dataUri);
  const localMediaHash = `gif${gif.id}`;
  const isIntersecting = useIsIntersecting(ref, observeIntersection);
  const loadAndPlay = isIntersecting && !isDisabled;
  const previewBlobUrl = useMedia(`${localMediaHash}?size=m`, !loadAndPlay, ApiMediaFormat.BlobUrl);
  const thumbRef = useCanvasBlur(gif.thumbnail?.dataUri, Boolean(previewBlobUrl));
  const videoData = useMedia(localMediaHash, !loadAndPlay, ApiMediaFormat.BlobUrl);
  const shouldRenderVideo = Boolean(loadAndPlay && videoData);
  const { isBuffered, bufferingHandlers } = useBuffering(true);
  const shouldRenderSpinner = loadAndPlay && !isBuffered;
  const isVideoReady = loadAndPlay && isBuffered;

  useVideoCleanup(videoRef, [shouldRenderVideo]);

  const handleClick = useCallback(
    () => onClick({
      ...gif,
      blobUrl: videoData,
    }),
    [onClick, gif, videoData],
  );

  const fullClassName = buildClassName(
    'GifButton',
    gif.width && gif.height && gif.width < gif.height ? 'vertical' : 'horizontal',
    localMediaHash,
    className,
  );

  return (
    <div
      ref={ref}
      className={fullClassName}
      onMouseDown={preventMessageInputBlurWithBubbling}
      onClick={handleClick}
    >
      {hasThumbnail && (
        <canvas
          ref={thumbRef}
          className="thumbnail"
          // We need to always render to avoid blur re-calculation
          // @ts-ignore
          style={isVideoReady ? 'display: none;' : undefined}
        />
      )}
      {previewBlobUrl && !isVideoReady && (
        <img
          src={previewBlobUrl}
          alt=""
          className="preview"
        />
      )}
      {shouldRenderVideo && (
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="none"
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...bufferingHandlers}
        >
          <source src={videoData} />
        </video>
      )}
      {shouldRenderSpinner && (
        <Spinner color={previewBlobUrl || hasThumbnail ? 'white' : 'black'} />
      )}
    </div>
  );
};

export default memo(GifButton);
