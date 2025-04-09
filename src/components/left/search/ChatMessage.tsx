import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat, ApiMessage, ApiMessageOutgoingStatus,
  ApiUser,
} from '../../../api/types';
import type { OldLangFn } from '../../../hooks/useOldLang';

import {
  getMessageIsSpoiler,
  getMessageMediaHash,
  getMessageMediaThumbDataUri,
  getMessageRoundVideo,
  getMessageSticker,
  getMessageVideo,
  getPrivateChatUserId,
} from '../../../global/helpers';
import { selectChat, selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatPastTimeShort } from '../../../util/dates/dateFormat';
import { renderMessageSummary } from '../../common/helpers/renderMessageText';

import useAppLayout from '../../../hooks/useAppLayout';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useOldLang from '../../../hooks/useOldLang';
import useSelectWithEnter from '../../../hooks/useSelectWithEnter';

import Avatar from '../../common/Avatar';
import FullNameTitle from '../../common/FullNameTitle';
import Icon from '../../common/icons/Icon';
import Link from '../../ui/Link';
import ListItem from '../../ui/ListItem';

import './ChatMessage.scss';

type OwnProps = {
  searchQuery?: string;
  message: ApiMessage;
  chatId: string;
};

type StateProps = {
  chat?: ApiChat;
  privateChatUser?: ApiUser;
  lastMessageOutgoingStatus?: ApiMessageOutgoingStatus;
};

const ChatMessage: FC<OwnProps & StateProps> = ({
  message,
  searchQuery,
  chatId,
  chat,
  privateChatUser,
}) => {
  const { focusMessage } = getActions();

  const { isMobile } = useAppLayout();
  const mediaThumbnail = !getMessageSticker(message) ? getMessageMediaThumbDataUri(message) : undefined;
  const mediaBlobUrl = useMedia(getMessageMediaHash(message, 'micro'));
  const isRoundVideo = Boolean(getMessageRoundVideo(message));

  const handleClick = useLastCallback(() => {
    focusMessage({ chatId, messageId: message.id, shouldReplaceHistory: true });
  });

  const lang = useOldLang();

  const buttonRef = useSelectWithEnter(handleClick);

  if (!chat) {
    return undefined;
  }

  const peer = privateChatUser || chat;

  return (
    <ListItem
      className="ChatMessage chat-item-clickable"
      ripple={!isMobile}
      onClick={handleClick}
      buttonRef={buttonRef}
    >
      <Avatar
        peer={peer}
        isSavedMessages={privateChatUser?.isSelf}
      />
      <div className="info">
        <div className="info-row">
          <FullNameTitle
            peer={peer}
            withEmojiStatus
            isSavedMessages={chatId === privateChatUser?.id && privateChatUser?.isSelf}
          />
          <div className="message-date">
            <Link className="date">
              {formatPastTimeShort(lang, message.date * 1000)}
            </Link>
          </div>

        </div>
        <div className="subtitle">
          <div className="message" dir="auto">
            {renderSummary(lang, message, mediaBlobUrl || mediaThumbnail, searchQuery, isRoundVideo)}
          </div>
        </div>
      </div>
    </ListItem>
  );
};

function renderSummary(
  lang: OldLangFn, message: ApiMessage, blobUrl?: string, searchQuery?: string, isRoundVideo?: boolean,
) {
  if (!blobUrl) {
    return renderMessageSummary(lang, message, undefined, searchQuery);
  }

  const isSpoiler = getMessageIsSpoiler(message);

  return (
    <span className="media-preview">
      <img
        src={blobUrl}
        alt=""
        className={
          buildClassName('media-preview--image', isRoundVideo && 'round', isSpoiler && 'media-preview-spoiler')
        }
        draggable={false}
      />
      {getMessageVideo(message) && <Icon name="play" />}
      {renderMessageSummary(lang, message, true, searchQuery)}
    </span>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    if (!chat) {
      return {};
    }

    const privateChatUserId = getPrivateChatUserId(chat);
    const privateChatUser = privateChatUserId ? selectUser(global, privateChatUserId) : undefined;

    return {
      chat,
      ...(privateChatUserId && { privateChatUser }),
    };
  },
)(ChatMessage));
