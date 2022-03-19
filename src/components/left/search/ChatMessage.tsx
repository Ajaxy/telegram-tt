import React, {
  FC, memo, useCallback,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../modules';

import {
  ApiChat, ApiUser, ApiMessage, ApiMessageOutgoingStatus,
} from '../../../api/types';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';
import {
  getChatTitle,
  getPrivateChatUserId,
  getMessageMediaHash,
  getMessageMediaThumbDataUri,
  getMessageVideo,
  getMessageRoundVideo,
} from '../../../modules/helpers';
import { selectChat, selectUser } from '../../../modules/selectors';
import renderText from '../../common/helpers/renderText';
import useMedia from '../../../hooks/useMedia';
import { formatPastTimeShort } from '../../../util/dateFormat';
import useLang, { LangFn } from '../../../hooks/useLang';
import useSelectWithEnter from '../../../hooks/useSelectWithEnter';
import { renderMessageSummary } from '../../common/helpers/renderMessageText';

import Avatar from '../../common/Avatar';
import VerifiedIcon from '../../common/VerifiedIcon';
import ListItem from '../../ui/ListItem';
import Link from '../../ui/Link';

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
  lastSyncTime?: number;
};

const ChatMessage: FC<OwnProps & StateProps> = ({
  message,
  searchQuery,
  chatId,
  chat,
  privateChatUser,
  lastSyncTime,
}) => {
  const { focusMessage } = getActions();

  const mediaThumbnail = getMessageMediaThumbDataUri(message);
  const mediaBlobUrl = useMedia(getMessageMediaHash(message, 'micro'));
  const isRoundVideo = Boolean(getMessageRoundVideo(message));

  const handleClick = useCallback(() => {
    focusMessage({ chatId, messageId: message.id });
  }, [chatId, focusMessage, message.id]);

  const lang = useLang();

  const buttonRef = useSelectWithEnter(handleClick);

  if (!chat) {
    return undefined;
  }

  return (
    <ListItem
      className="ChatMessage chat-item-clickable"
      ripple={!IS_SINGLE_COLUMN_LAYOUT}
      onClick={handleClick}
      buttonRef={buttonRef}
    >
      <Avatar
        chat={chat}
        user={privateChatUser}
        isSavedMessages={privateChatUser?.isSelf}
        lastSyncTime={lastSyncTime}
      />
      <div className="info">
        <div className="info-row">
          <div className="title">
            <h3 dir="auto">{renderText(getChatTitle(lang, chat, privateChatUser))}</h3>
            {chat.isVerified && <VerifiedIcon />}
          </div>
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
  lang: LangFn, message: ApiMessage, blobUrl?: string, searchQuery?: string, isRoundVideo?: boolean,
) {
  if (!blobUrl) {
    return renderMessageSummary(lang, message, undefined, searchQuery);
  }

  return (
    <span className="media-preview">
      <img src={blobUrl} alt="" className={isRoundVideo ? 'round' : undefined} />
      {getMessageVideo(message) && <i className="icon-play" />}
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

    return {
      chat,
      lastSyncTime: global.lastSyncTime,
      ...(privateChatUserId && { privateChatUser: selectUser(global, privateChatUserId) }),
    };
  },
)(ChatMessage));
