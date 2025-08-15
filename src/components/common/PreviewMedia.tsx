import type { FC } from '../../lib/teact/teact';
import { memo, useRef } from '../../lib/teact/teact';

import type { ApiBotPreviewMedia } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import buildClassName from '../../util/buildClassName';
import { formatMediaDuration } from '../../util/dates/dateFormat';
import stopEvent from '../../util/stopEvent';

import useMessageMediaHash from '../../hooks/media/useMessageMediaHash';
import useThumbnail from '../../hooks/media/useThumbnail';
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
  const ref = useRef<HTMLDivElement>();

  const isIntersecting = useIsIntersecting(ref, observeIntersection);
  const thumbDataUri = useThumbnail(media);

  const mediaHash = useMessageMediaHash(media, 'preview');
  const mediaBlobUrl = useMedia(mediaHash, !isIntersecting);
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
