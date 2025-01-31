import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage } from '../../../api/types';

import { getGamePreviewPhotoHash, getGamePreviewVideoHash, getMessageText } from '../../../global/helpers';

import useMedia from '../../../hooks/useMedia';

import Skeleton from '../../ui/placeholder/Skeleton';

import './Game.scss';

const DEFAULT_PREVIEW_DIMENSIONS = {
  width: 480,
  height: 270,
};

type OwnProps = {
  message: ApiMessage;
  canAutoLoadMedia?: boolean;
};

const Game: FC<OwnProps> = ({
  message,
  canAutoLoadMedia,
}) => {
  const { clickBotInlineButton } = getActions();
  const game = message.content.game!;
  const {
    title, description,
  } = game;

  const photoHash = getGamePreviewPhotoHash(game);
  const videoHash = getGamePreviewVideoHash(game);
  const photoBlobUrl = useMedia(photoHash, !canAutoLoadMedia);
  const videoBlobUrl = useMedia(videoHash, !canAutoLoadMedia);

  const handleGameClick = () => {
    clickBotInlineButton({
      chatId: message.chatId,
      messageId: message.id,
      button: message.inlineButtons![0][0],
    });
  };

  return (
    <div className="Game">
      <div
        className="preview"
        style={`width: ${DEFAULT_PREVIEW_DIMENSIONS.width}px; height: ${DEFAULT_PREVIEW_DIMENSIONS.height}px`}
        onClick={handleGameClick}
      >
        {!photoBlobUrl && !videoBlobUrl && (
          <Skeleton className="skeleton preview-content" />
        )}
        {photoBlobUrl && (
          <img
            className="preview-content"
            src={photoBlobUrl}
            alt={title}
            draggable={false}
          />
        )}
        {videoBlobUrl && (
          <video
            className="preview-content"
            playsInline
            muted
            disablePictureInPicture
            autoPlay
            loop
            src={videoBlobUrl}
          />
        )}
      </div>
      <div className="title">{title}</div>
      {!getMessageText(message) && <div className="description">{description}</div>}
    </div>
  );
};

export default memo(Game);
