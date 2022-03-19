import React, {
  FC, memo, useCallback, useRef,
} from '../../lib/teact/teact';

import { ApiMessage } from '../../api/types';

import { formatMediaDuration } from '../../util/dateFormat';
import stopEvent from '../../util/stopEvent';
import {
  getMessageHtmlId,
  getMessageMediaHash,
  getMessageMediaThumbDataUri,
  getMessageVideo,
} from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';
import { ObserveFn, useIsIntersecting } from '../../hooks/useIntersectionObserver';

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

  const handleClick = useCallback(() => {
    onClick!(message.id, message.chatId);
  }, [message.id, message.chatId, onClick]);

  return (
    <div
      ref={ref}
      id={`${idPrefix}${getMessageHtmlId(message.id)}`}
      className="Media scroll-item"
      onClick={onClick ? handleClick : undefined}
    >
      <img
        src={thumbDataUri}
        alt=""
        draggable={!isProtected}
        decoding="async"
        onContextMenu={isProtected ? stopEvent : undefined}
      />
      <img
        src={mediaBlobUrl}
        className={buildClassName('full-media', transitionClassNames)}
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

export default memo(Media);
