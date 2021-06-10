import React, { FC, useCallback } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ApiChat, ApiMessage, ApiUser } from '../../api/types';

import { getSenderTitle, isChatPrivate } from '../../modules/helpers';
import { formatMediaDateTime } from '../../util/dateFormat';
import renderText from '../common/helpers/renderText';
import {
  selectChat,
  selectChatMessage,
  selectSender,
  selectUser,
} from '../../modules/selectors';
import { pick } from '../../util/iteratees';
import useLang from '../../hooks/useLang';

import Avatar from '../common/Avatar';

import './SenderInfo.scss';

type OwnProps = {
  chatId?: number;
  messageId?: number;
  isAvatar?: boolean;
};

type StateProps = {
  sender?: ApiUser | ApiChat;
  message?: ApiMessage;
};

type DispatchProps = Pick<GlobalActions, 'closeMediaViewer' | 'focusMessage'>;

const SenderInfo: FC<OwnProps & StateProps & DispatchProps> = ({
  chatId, messageId, sender, isAvatar, message, closeMediaViewer, focusMessage,
}) => {
  const handleFocusMessage = useCallback(() => {
    closeMediaViewer();
    focusMessage({ chatId, messageId });
  }, [chatId, focusMessage, messageId, closeMediaViewer]);

  const lang = useLang();

  if (!sender || (!message && !isAvatar)) {
    return undefined;
  }

  const isFromChat = sender.id < 0;
  const senderTitle = getSenderTitle(lang, sender);

  return (
    <div className="SenderInfo" onClick={handleFocusMessage}>
      {isFromChat ? (
        <Avatar key={sender.id} size="medium" chat={sender as ApiChat} />
      ) : (
        <Avatar key={sender.id} size="medium" user={sender as ApiUser} />
      )}
      <div className="meta">
        <div className="title" dir="auto">
          {senderTitle && renderText(senderTitle)}
        </div>
        <div className="date" dir="auto">
          {isAvatar ? lang('lng_mediaview_profile_photo') : formatMediaDateTime(lang, message!.date * 1000)}
        </div>
      </div>
    </div>
  );
};

export default withGlobal<OwnProps>(
  (global, { chatId, messageId, isAvatar }): StateProps => {
    if (isAvatar && chatId) {
      return {
        sender: isChatPrivate(chatId) ? selectUser(global, chatId) : selectChat(global, chatId),
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
  (setGlobal, actions): DispatchProps => pick(actions, ['closeMediaViewer', 'focusMessage']),
)(SenderInfo);
