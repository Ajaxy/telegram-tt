import React, {
  FC, memo, useCallback,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import {
  ApiChat, ApiUser, ApiMessage, ApiMessageOutgoingStatus,
} from '../../../api/types';

import { IS_MOBILE_SCREEN } from '../../../util/environment';
import {
  getChatTitle,
  getPrivateChatUserId,
  getMessageMediaHash,
  getMessageSummaryText,
  getMessageMediaThumbDataUri,
  getMessageVideo,
} from '../../../modules/helpers';
import { selectChat, selectUser } from '../../../modules/selectors';
import renderText from '../../common/helpers/renderText';
import { pick } from '../../../util/iteratees';
import useMedia from '../../../hooks/useMedia';
import { formatPastTimeShort } from '../../../util/dateFormat';
import useLang, { LangFn } from '../../../hooks/useLang';

import Avatar from '../../common/Avatar';
import VerifiedIcon from '../../common/VerifiedIcon';
import ListItem from '../../ui/ListItem';
import Link from '../../ui/Link';

import './ChatMessage.scss';

type OwnProps = {
  searchQuery?: string;
  message: ApiMessage;
  chatId: number;
};

type StateProps = {
  chat?: ApiChat;
  privateChatUser?: ApiUser;
  lastMessageOutgoingStatus?: ApiMessageOutgoingStatus;
  lastSyncTime?: number;
};

type DispatchProps = Pick<GlobalActions, 'focusMessage'>;

const ChatMessage: FC<OwnProps & StateProps & DispatchProps> = ({
  message,
  searchQuery,
  chatId,
  chat,
  privateChatUser,
  focusMessage,
  lastSyncTime,
}) => {
  const mediaThumbnail = getMessageMediaThumbDataUri(message);
  const mediaBlobUrl = useMedia(getMessageMediaHash(message, 'micro'));

  const handleClick = useCallback(() => {
    focusMessage({ chatId, messageId: message.id });
  }, [chatId, focusMessage, message.id]);

  const lang = useLang();

  if (!chat) {
    return undefined;
  }

  return (
    <ListItem
      className="ChatMessage chat-item-clickable"
      ripple={!IS_MOBILE_SCREEN}
      onClick={handleClick}
    >
      <Avatar
        chat={chat}
        user={privateChatUser}
        withOnlineStatus
        isSavedMessages={privateChatUser && privateChatUser.isSelf}
        lastSyncTime={lastSyncTime}
      />
      <div className="info">
        <div className="info-row">
          <div className="title">
            <h3>{renderText(getChatTitle(chat, privateChatUser))}</h3>
            {chat.isVerified && <VerifiedIcon />}
          </div>
          <div className="message-date">
            <Link className="date">
              {formatPastTimeShort(message.date * 1000)}
            </Link>
          </div>

        </div>
        <div className="subtitle">
          <div className="message">
            {renderMessageSummary(lang, message, mediaBlobUrl || mediaThumbnail, searchQuery)}
          </div>
        </div>
      </div>
    </ListItem>
  );
};

function renderMessageSummary(lang: LangFn, message: ApiMessage, blobUrl?: string, searchQuery?: string) {
  if (!blobUrl) {
    return renderText(getMessageSummaryText(lang, message));
  }

  return (
    <span className="media-preview">
      <img src={blobUrl} alt="" />
      {getMessageVideo(message) && <i className="icon-play" />}
      {renderText(getMessageSummaryText(lang, message, true), ['emoji', 'highlight'], { highlight: searchQuery })}
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
      ...(privateChatUserId && { privateChatUser: selectUser(global, privateChatUserId) }),
      lastSyncTime: global.lastSyncTime,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'focusMessage',
  ]),
)(ChatMessage));
