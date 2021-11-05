import React, { FC, memo, useCallback } from '../../lib/teact/teact';

import { ApiMessage } from '../../api/types';

import { formatMediaDuration } from '../../util/dateFormat';
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
  onClick?: (messageId: number, chatId: string) => void;
};

const Media: FC<OwnProps> = ({ message, idPrefix = 'shared-media', onClick }) => {
  const handleClick = useCallback(() => {
    onClick!(message.id, message.chatId);
  }, [message.id, message.chatId, onClick]);

  const thumbDataUri = getMessageMediaThumbDataUri(message);
  const mediaBlobUrl = useMedia(getMessageMediaHash(message, 'pictogram'));
  const transitionClassNames = useMediaTransition(mediaBlobUrl);

  const video = getMessageVideo(message);

  return (
    <div id={`${idPrefix}${message.id}`} className="Media scroll-item" onClick={onClick ? handleClick : undefined}>
      <img src={thumbDataUri} alt="" />
      <img src={mediaBlobUrl} className={buildClassName('full-media', transitionClassNames)} alt="" />
      {video && <span className="video-duration">{video.isGif ? 'GIF' : formatMediaDuration(video.duration)}</span>}
    </div>
  );
};

export default memo(Media);
