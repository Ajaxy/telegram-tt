import React, { FC, useCallback } from '../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../lib/teact/teactn';

import { ApiChat, ApiMessage, ApiUser } from '../../api/types';

import { getSenderTitle, isUserId } from '../../modules/helpers';
import { formatMediaDateTime } from '../../util/dateFormat';
import renderText from '../common/helpers/renderText';
import {
  selectChat,
  selectChatMessage,
  selectSender,
  selectUser,
} from '../../modules/selectors';
import useLang from '../../hooks/useLang';

import Avatar from '../common/Avatar';

import './SenderInfo.scss';

type OwnProps = {
  chatId?: string;
  messageId?: number;
  isAvatar?: boolean;
};

type StateProps = {
  sender?: ApiUser | ApiChat;
  message?: ApiMessage;
};

const SenderInfo: FC<OwnProps & StateProps> = ({
  chatId,
  messageId,
  sender,
  isAvatar,
  message,
}) => {
  const {
    closeMediaViewer,
    focusMessage,
  } = getDispatch();

  const handleFocusMessage = useCallback(() => {
    closeMediaViewer();
    focusMessage({ chatId, messageId });
  }, [chatId, focusMessage, messageId, closeMediaViewer]);

  const lang = useLang();

  if (!sender || (!message && !isAvatar)) {
    return undefined;
  }

  const senderTitle = getSenderTitle(lang, sender);

  return (
    <div className="SenderInfo" onClick={handleFocusMessage}>
      {isUserId(sender.id) ? (
        <Avatar key={sender.id} size="medium" user={sender as ApiUser} />
      ) : (
        <Avatar key={sender.id} size="medium" chat={sender as ApiChat} />
      )}
      <div className="meta">
        <div className="title" dir="auto">
          {senderTitle && renderText(senderTitle)}
        </div>
        <div className="date" dir="auto">
          {isAvatar
            ? lang('lng_mediaview_profile_photo')
            : formatMediaDateTime(lang, message!.date * 1000, true)}
        </div>
      </div>
    </div>
  );
};

export default withGlobal<OwnProps>(
  (global, { chatId, messageId, isAvatar }): StateProps => {
    if (isAvatar && chatId) {
      return {
        sender: isUserId(chatId) ? selectUser(global, chatId) : selectChat(global, chatId),
      };
    }

    if (!messageId || !chatId) {
      return {};
    }

    const message = selectChatMessage(global, chatId, messageId);

    return {
      message,
      sender: message && selectSender(global, message),
    };
  },
)(SenderInfo);
