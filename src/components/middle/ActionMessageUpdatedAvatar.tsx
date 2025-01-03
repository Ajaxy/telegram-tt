import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiMessage } from '../../api/types';
import type { TextPart } from '../../types';
import { MAIN_THREAD_ID } from '../../api/types';
import { MediaViewerOrigin } from '../../types';

import useOldLang from '../../hooks/useOldLang';

import Avatar from '../common/Avatar';

type OwnProps = {
  message: ApiMessage;
  renderContent: () => TextPart | undefined;
};

const ActionMessageUpdatedAvatar: FC<OwnProps> = ({
  message,
  renderContent,
}) => {
  const {
    openMediaViewer,
  } = getActions();

  const lang = useOldLang();
  const isVideo = message.content.action!.photo?.isVideo;

  const handleViewUpdatedAvatar = () => {
    openMediaViewer({
      chatId: message.chatId,
      messageId: message.id,
      threadId: MAIN_THREAD_ID,
      origin: MediaViewerOrigin.SuggestedAvatar,
    });
  };

  return (
    <>
      <span>{renderContent()}</span>
      <span
        className="action-message-updated-avatar"
        tabIndex={0}
        role="button"
        onClick={handleViewUpdatedAvatar}
        aria-label={lang('ViewPhotoAction')}
      >
        <Avatar
          photo={message.content.action!.photo}
          loopIndefinitely
          withVideo={isVideo}
          size="jumbo"
        />
      </span>
    </>
  );
};

export default memo(ActionMessageUpdatedAvatar);
