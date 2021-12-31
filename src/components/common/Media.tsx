import React, { FC, memo, useCallback } from '../../lib/teact/teact';

import { ApiMessage } from '../../api/types';

import { formatMediaDuration } from '../../util/dateFormat';
import stopEvent from '../../util/stopEvent';
import {
  getMessageMediaHash,
  getMessageMediaThumbDataUri,
  getMessageVideo,
} from '../../modules/helpers';
import buildClassName from '../../util/buildClassName';
import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';

import './Media.scss';

type OwnProps = {
  message: ApiMessage;
  idPrefix?: string;
  isProtected?: boolean;
  onClick?: (messageId: number, chatId: string) => void;
};

const Media: FC<OwnProps> = ({
  message,
  idPrefix = 'shared-media',
  isProtected,
  onClick,
}) => {
  const handleClick = useCallback(() => {
    onClick!(message.id, message.chatId);
  }, [message.id, message.chatId, onClick]);

  const thumbDataUri = getMessageMediaThumbDataUri(message);
  const mediaBlobUrl = useMedia(getMessageMediaHash(message, 'pictogram'));
  const transitionClassNames = useMediaTransition(mediaBlobUrl);

  const video = getMessageVideo(message);

  return (
    <div id={`${idPrefix}${message.id}`} className="Media scroll-item" onClick={onClick ? handleClick : undefined}>
      <img src={thumbDataUri} alt="" draggable={!isProtected} onContextMenu={isProtected ? stopEvent : undefined} />
      <img
        src={mediaBlobUrl}
        className={buildClassName('full-media', transitionClassNames)}
        alt=""
        draggable={!isProtected}
        onContextMenu={isProtected ? stopEvent : undefined}
      />
      {video && <span className="video-duration">{video.isGif ? 'GIF' : formatMediaDuration(video.duration)}</span>}
      {isProtected && <span className="protector" />}
    </div>
  );
};

export default memo(Media);
