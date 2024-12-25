import type { FC } from '../../lib/teact/teact';
import React, { memo, useRef } from '../../lib/teact/teact';

import type { ApiBotPreviewMedia } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import {
  getMessageMediaHash, getMessageMediaThumbDataUri,
} from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import { formatMediaDuration } from '../../util/dates/dateFormat';
import stopEvent from '../../util/stopEvent';

import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useMediaTransitionDeprecated from '../../hooks/useMediaTransitionDeprecated';

import './Media.scss';

type OwnProps = {
  media: ApiBotPreviewMedia;
  idPrefix?: string;
  isProtected?: boolean;
  observeIntersection?: ObserveFn;
  onClick: (index: number) => void;
  index: number;
};

const PreviewMedia: FC<OwnProps> = ({
  media,
  idPrefix = 'preview-media',
  isProtected,
  observeIntersection,
  onClick,
  index,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const isIntersecting = useIsIntersecting(ref, observeIntersection);
  const thumbDataUri = getMessageMediaThumbDataUri(media);

  const mediaBlobUrl = useMedia(getMessageMediaHash(media, 'preview'), !isIntersecting);
  const transitionClassNames = useMediaTransitionDeprecated(mediaBlobUrl);

  const video = media.content.video;

  const handleClick = useLastCallback(() => {
    onClick(index);
  });

  return (
    <div
      ref={ref}
      id={`${idPrefix}${index}`}
      className="Media scroll-item"
      onClick={handleClick}
    >
      <img
        src={thumbDataUri}
        className="media-miniature"
        alt=""
        draggable={!isProtected}
        decoding="async"
        onContextMenu={isProtected ? stopEvent : undefined}
      />
      <img
        src={mediaBlobUrl}
        className={buildClassName('full-media', 'media-miniature', transitionClassNames)}
        alt=""
        draggable={!isProtected}
        decoding="async"
        onContextMenu={isProtected ? stopEvent : undefined}
      />
      {video && <span className="video-duration">{video.isGif ? 'GIF' : formatMediaDuration(video.duration)}</span>}
      {isProtected && <span className="protector" />}
    </div>
  );
};

export default memo(PreviewMedia);
