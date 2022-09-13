import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat, ApiUser, ApiMessage, ApiMessageOutgoingStatus,
} from '../../../api/types';
import type { AnimationLevel } from '../../../types';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';
import {
  getChatTitle,
  getPrivateChatUserId,
  getMessageMediaHash,
  getMessageMediaThumbDataUri,
  getMessageVideo,
  getMessageRoundVideo,
  getMessageSticker,
} from '../../../global/helpers';
import { selectChat, selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import renderText from '../../common/helpers/renderText';
import { formatPastTimeShort } from '../../../util/dateFormat';
import { renderMessageSummary } from '../../common/helpers/renderMessageText';

import useMedia from '../../../hooks/useMedia';
import type { LangFn } from '../../../hooks/useLang';
import useLang from '../../../hooks/useLang';
import useSelectWithEnter from '../../../hooks/useSelectWithEnter';

import Avatar from '../../common/Avatar';
import VerifiedIcon from '../../common/VerifiedIcon';
import ListItem from '../../ui/ListItem';
import Link from '../../ui/Link';
import FakeIcon from '../../common/FakeIcon';
import PremiumIcon from '../../common/PremiumIcon';

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
  animationLevel?: AnimationLevel;
};

const ChatMessage: FC<OwnProps & StateProps> = ({
  message,
  searchQuery,
  chatId,
  chat,
  privateChatUser,
  animationLevel,
  lastSyncTime,
}) => {
  const { focusMessage } = getActions();

  const mediaThumbnail = !getMessageSticker(message) ? getMessageMediaThumbDataUri(message) : undefined;
  const mediaBlobUrl = useMedia(getMessageMediaHash(message, 'micro'));
  const isRoundVideo = Boolean(getMessageRoundVideo(message));

  const handleClick = useCallback(() => {
    focusMessage({ chatId, messageId: message.id, shouldReplaceHistory: true });
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
        withVideo
        animationLevel={animationLevel}
      />
      <div className="info">
        <div className="info-row">
          <div className="title">
            <h3 dir="auto">{renderText(getChatTitle(lang, chat, privateChatUser))}</h3>
            {chat.isVerified && <VerifiedIcon />}
            {privateChatUser?.isPremium && <PremiumIcon />}
            {chat.fakeType && <FakeIcon fakeType={chat.fakeType} />}
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
      <img src={blobUrl} alt="" className={buildClassName('media-preview--image', isRoundVideo && 'round')} />
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
      animationLevel: global.settings.byKey.animationLevel,
      ...(privateChatUserId && { privateChatUser: selectUser(global, privateChatUserId) }),
    };
  },
)(ChatMessage));
