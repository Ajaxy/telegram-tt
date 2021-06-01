import { MouseEvent as ReactMouseEvent } from 'react';
import React, {
  FC, useEffect, useCallback, memo,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { ApiChat, ApiTypingStatus } from '../../api/types';
import { GlobalActions, GlobalState } from '../../global/types';
import { MediaViewerOrigin } from '../../types';

import {
  getChatTypeString,
  getChatTitle,
  isChatSuperGroup,
} from '../../modules/helpers';
import { selectChat, selectChatMessages, selectChatOnlineCount } from '../../modules/selectors';
import renderText from './helpers/renderText';
import { pick } from '../../util/iteratees';
import useLang, { LangFn } from '../../hooks/useLang';

import Avatar from './Avatar';
import VerifiedIcon from './VerifiedIcon';
import TypingStatus from './TypingStatus';

type OwnProps = {
  chatId: number;
  typingStatus?: ApiTypingStatus;
  avatarSize?: 'small' | 'medium' | 'large' | 'jumbo';
  withMediaViewer?: boolean;
  withUsername?: boolean;
  withFullInfo?: boolean;
  withUpdatingStatus?: boolean;
  withChatType?: boolean;
};

type StateProps = {
  chat?: ApiChat;
  onlineCount?: number;
  areMessagesLoaded: boolean;
} & Pick<GlobalState, 'lastSyncTime'>;

type DispatchProps = Pick<GlobalActions, 'loadFullChat' | 'openMediaViewer'>;

const GroupChatInfo: FC<OwnProps & StateProps & DispatchProps> = ({
  typingStatus,
  avatarSize = 'medium',
  withMediaViewer,
  withUsername,
  withFullInfo,
  withUpdatingStatus,
  withChatType,
  chat,
  onlineCount,
  areMessagesLoaded,
  lastSyncTime,
  loadFullChat,
  openMediaViewer,
}) => {
  const isSuperGroup = chat && isChatSuperGroup(chat);
  const { id: chatId, isMin, isRestricted } = chat || {};

  useEffect(() => {
    if (chatId && !isMin && withFullInfo && lastSyncTime) {
      loadFullChat({ chatId });
    }
  }, [chatId, isMin, lastSyncTime, withFullInfo, loadFullChat, isSuperGroup]);

  const handleAvatarViewerOpen = useCallback((e: ReactMouseEvent<HTMLDivElement, MouseEvent>, hasPhoto: boolean) => {
    if (chat && hasPhoto) {
      e.stopPropagation();
      openMediaViewer({
        avatarOwnerId: chat.id,
        origin: avatarSize === 'jumbo' ? MediaViewerOrigin.ProfileAvatar : MediaViewerOrigin.MiddleHeaderAvatar,
      });
    }
  }, [chat, avatarSize, openMediaViewer]);

  const lang = useLang();

  if (!chat) {
    return undefined;
  }

  function renderStatusOrTyping() {
    if (withUpdatingStatus && !areMessagesLoaded && !isRestricted) {
      return (
        <span className="status">{lang('Updating')}</span>
      );
    }

    if (!chat) {
      return undefined;
    }

    if (typingStatus) {
      return <TypingStatus typingStatus={typingStatus} />;
    }

    if (withChatType) {
      return (
        <div className="status">{lang(getChatTypeString(chat))}</div>
      );
    }

    const handle = withUsername ? chat.username : undefined;
    const groupStatus = getGroupStatus(lang, chat);
    const onlineStatus = onlineCount ? `, ${lang('OnlineCount', onlineCount, 'i')}` : undefined;

    return (
      <div className="status">
        {handle && <span className="handle">{handle}</span>}
        <span className="group-status">{groupStatus}</span>
        {onlineStatus && <span className="online-status">{onlineStatus}</span>}
      </div>
    );
  }

  return (
    <div className="ChatInfo">
      <Avatar
        key={chat.id}
        size={avatarSize}
        chat={chat}
        onClick={withMediaViewer ? handleAvatarViewerOpen : undefined}
      />
      <div className="info">
        <div className="title">
          <h3>{renderText(getChatTitle(lang, chat))}</h3>
          {chat.isVerified && <VerifiedIcon />}
        </div>
        {renderStatusOrTyping()}
      </div>
    </div>
  );
};

function getGroupStatus(lang: LangFn, chat: ApiChat) {
  const chatTypeString = lang(getChatTypeString(chat));
  const { membersCount } = chat;

  if (chat.isRestricted) {
    return chatTypeString === 'Channel' ? 'channel is inaccessible' : 'group is inaccessible';
  }

  if (!membersCount) {
    return chatTypeString;
  }

  return chatTypeString === 'Channel'
    ? lang('Subscribers', membersCount, 'i')
    : lang('Members', membersCount, 'i');
}

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const { lastSyncTime } = global;
    const chat = selectChat(global, chatId);
    const onlineCount = chat ? selectChatOnlineCount(global, chat) : undefined;
    const areMessagesLoaded = Boolean(selectChatMessages(global, chatId));

    return {
      lastSyncTime, chat, onlineCount, areMessagesLoaded,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['loadFullChat', 'openMediaViewer']),
)(GroupChatInfo));
