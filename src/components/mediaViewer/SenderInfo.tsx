import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat, ApiMessage, ApiUser } from '../../api/types';

import { getSenderTitle, isUserId } from '../../global/helpers';
import { formatMediaDateTime } from '../../util/dateFormat';
import renderText from '../common/helpers/renderText';
import {
  selectChat,
  selectChatMessage,
  selectSender,
  selectUser,
} from '../../global/selectors';

import useLastCallback from '../../hooks/useLastCallback';
import useLang from '../../hooks/useLang';
import useAppLayout from '../../hooks/useAppLayout';

import Avatar from '../common/Avatar';

import './SenderInfo.scss';

type OwnProps = {
  chatId?: string;
  messageId?: number;
  isAvatar?: boolean;
  isFallbackAvatar?: boolean;
};

type StateProps = {
  sender?: ApiUser | ApiChat;
  message?: ApiMessage;
};

const ANIMATION_DURATION = 350;

const SenderInfo: FC<OwnProps & StateProps> = ({
  chatId,
  messageId,
  sender,
  isFallbackAvatar,
  isAvatar,
  message,
}) => {
  const {
    closeMediaViewer,
    focusMessage,
    toggleChatInfo,
  } = getActions();

  const { isMobile } = useAppLayout();

  const handleFocusMessage = useLastCallback(() => {
    closeMediaViewer();

    if (!chatId || !messageId) return;

    if (isMobile) {
      setTimeout(() => {
        toggleChatInfo({ force: false }, { forceSyncOnIOs: true });
        focusMessage({ chatId, messageId });
      }, ANIMATION_DURATION);
    } else {
      focusMessage({ chatId, messageId });
    }
  });

  const lang = useLang();

  if (!sender || (!message && !isAvatar)) {
    return undefined;
  }

  const senderTitle = getSenderTitle(lang, sender);

  return (
    <div className="SenderInfo" onClick={handleFocusMessage}>
      <Avatar key={sender.id} size="medium" peer={sender} />
      <div className="meta">
        <div className="title" dir="auto">
          {senderTitle && renderText(senderTitle)}
        </div>
        <div className="date" dir="auto">
          {isAvatar
            ? lang(isFallbackAvatar ? 'lng_mediaview_profile_public_photo' : 'lng_mediaview_profile_photo')
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
