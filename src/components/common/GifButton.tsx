import React, {
  FC, memo, useCallback, useRef,
} from '../../lib/teact/teact';

import { ApiMediaFormat, ApiVideo } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { ObserveFn, useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useMedia from '../../hooks/useMedia';
import useTransitionForMedia from '../../hooks/useTransitionForMedia';
import useBlur from '../../hooks/useBlur';
import useVideoCleanup from '../../hooks/useVideoCleanup';
import useBuffering from '../../hooks/useBuffering';

import Spinner from '../ui/Spinner';

import './GifButton.scss';

type OwnProps = {
  gif: ApiVideo;
  observeIntersection: ObserveFn;
  isDisabled?: boolean;
  onClick: (gif: ApiVideo) => void;
};

const GifButton: FC<OwnProps> = ({
  gif, observeIntersection, isDisabled, onClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const videoRef = useRef<HTMLVideoElement>(null);

  const localMediaHash = `gif${gif.id}`;
  const isIntersecting = useIsIntersecting(ref, observeIntersection);
  const loadAndPlay = isIntersecting && !isDisabled;
  const previewBlobUrl = useMedia(`${localMediaHash}?size=m`, !loadAndPlay, ApiMediaFormat.BlobUrl);
  const thumbDataUri = useBlur(gif.thumbnail && gif.thumbnail.dataUri, Boolean(previewBlobUrl));
  const previewData = previewBlobUrl || thumbDataUri;
  const videoData = useMedia(localMediaHash, !loadAndPlay, ApiMediaFormat.BlobUrl);
  const shouldRenderVideo = Boolean(loadAndPlay && videoData);
  const { transitionClassNames } = useTransitionForMedia(previewData || videoData, 'slow');
  const { isBuffered, bufferingHandlers } = useBuffering(true);
  const shouldRenderSpinner = loadAndPlay && !isBuffered;

  useVideoCleanup(videoRef, [shouldRenderVideo]);

  const handleClick = useCallback(
    () => onClick({
      ...gif,
      blobUrl: videoData,
    }),
    [onClick, gif, videoData],
  );

  const className = buildClassName(
    'GifButton',
    gif.width && gif.height && gif.width < gif.height ? 'vertical' : 'horizontal',
    transitionClassNames,
    localMediaHash,
  );

  return (
    <div
      ref={ref}
      className={className}
      onClick={handleClick}
    >
      {previewData && !shouldRenderVideo && (
        <div
          className="preview"
          // @ts-ignore
          style={`background-image: url(${previewData});`}
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
          poster={previewData}
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...bufferingHandlers}
        >
          <source src={videoData} />
        </video>
      )}
      {shouldRenderSpinner && (
        <Spinner color={previewData ? 'white' : 'black'} />
      )}
    </div>
  );
};

export default memo(GifButton);
