import React, { memo, useCallback, useRef } from '../../lib/teact/teact';

import type { FC } from '../../lib/teact/teact';
import type { ApiMessage } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { formatMediaDuration } from '../../util/dateFormat';
import stopEvent from '../../util/stopEvent';
import {
  getMessageHtmlId,
  getMessageIsSpoiler,
  getMessageMediaHash,
  getMessageMediaThumbDataUri,
  getMessageVideo,
} from '../../global/helpers';
import buildClassName from '../../util/buildClassName';

import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';
import useFlag from '../../hooks/useFlag';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';

import MediaSpoiler from './MediaSpoiler';

import './Media.scss';

type OwnProps = {
  message: ApiMessage;
  idPrefix?: string;
  isProtected?: boolean;
  observeIntersection?: ObserveFn;
  onClick?: (messageId: number, chatId: string) => void;
};

const Media: FC<OwnProps> = ({
  message,
  idPrefix = 'shared-media',
  isProtected,
  observeIntersection,
  onClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const isIntersecting = useIsIntersecting(ref, observeIntersection);
  const thumbDataUri = getMessageMediaThumbDataUri(message);
  const mediaBlobUrl = useMedia(getMessageMediaHash(message, 'pictogram'), !isIntersecting);
  const transitionClassNames = useMediaTransition(mediaBlobUrl);

  const video = getMessageVideo(message);

  const hasSpoiler = getMessageIsSpoiler(message);
  const [isSpoilerShown, , hideSpoiler] = useFlag(hasSpoiler);

  const handleClick = useCallback(() => {
    hideSpoiler();
    onClick!(message.id, message.chatId);
  }, [hideSpoiler, message, onClick]);

  return (
    <div
      ref={ref}
      id={`${idPrefix}${getMessageHtmlId(message.id)}`}
      className="Media scroll-item"
      onClick={onClick ? handleClick : undefined}
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
      {hasSpoiler && (
        <MediaSpoiler
          thumbDataUri={mediaBlobUrl || thumbDataUri}
          isVisible={isSpoilerShown}
          className="media-spoiler"
        />
      )}
      {video && <span className="video-duration">{video.isGif ? 'GIF' : formatMediaDuration(video.duration)}</span>}
      {isProtected && <span className="protector" />}
    </div>
  );
};

export default memo(Media);
