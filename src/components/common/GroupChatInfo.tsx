import type { MouseEvent as ReactMouseEvent } from 'react';
import type { FC } from '../../lib/teact/teact';
import React, { useEffect, useCallback, memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat, ApiTypingStatus } from '../../api/types';
import type { GlobalState } from '../../global/types';
import { MediaViewerOrigin } from '../../types';

import {
  getChatTypeString,
  getChatTitle,
  isChatSuperGroup,
} from '../../global/helpers';
import { selectChat, selectChatMessages, selectChatOnlineCount } from '../../global/selectors';
import renderText from './helpers/renderText';
import type { LangFn } from '../../hooks/useLang';
import useLang from '../../hooks/useLang';

import Avatar from './Avatar';
import VerifiedIcon from './VerifiedIcon';
import TypingStatus from './TypingStatus';
import DotAnimation from './DotAnimation';
import FakeIcon from './FakeIcon';

type OwnProps = {
  chatId: string;
  typingStatus?: ApiTypingStatus;
  avatarSize?: 'small' | 'medium' | 'large' | 'jumbo';
  status?: string;
  withDots?: boolean;
  withMediaViewer?: boolean;
  withUsername?: boolean;
  withFullInfo?: boolean;
  withUpdatingStatus?: boolean;
  withChatType?: boolean;
  noRtl?: boolean;
};

type StateProps =
  {
    chat?: ApiChat;
    onlineCount?: number;
    areMessagesLoaded: boolean;
  }
  & Pick<GlobalState, 'lastSyncTime'>;

const GroupChatInfo: FC<OwnProps & StateProps> = ({
  typingStatus,
  avatarSize = 'medium',
  status,
  withDots,
  withMediaViewer,
  withUsername,
  withFullInfo,
  withUpdatingStatus,
  withChatType,
  noRtl,
  chat,
  onlineCount,
  areMessagesLoaded,
  lastSyncTime,
}) => {
  const {
    loadFullChat,
    openMediaViewer,
  } = getActions();

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
    if (status) {
      return withDots ? (
        <DotAnimation className="status" content={status} />
      ) : (
        <span className="status" dir="auto">{status}</span>
      );
    }

    if (withUpdatingStatus && !areMessagesLoaded && !isRestricted) {
      return (
        <DotAnimation className="status" content={lang('Updating')} />
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
        <span className="status" dir="auto">{lang(getChatTypeString(chat))}</span>
      );
    }

    const handle = withUsername ? chat.username : undefined;
    const groupStatus = getGroupStatus(lang, chat);
    const onlineStatus = onlineCount ? `, ${lang('OnlineCount', onlineCount, 'i')}` : undefined;

    return (
      <span className="status">
        {handle && <span className="handle">{handle}</span>}
        <span className="group-status">{groupStatus}</span>
        {onlineStatus && <span className="online-status">{onlineStatus}</span>}
      </span>
    );
  }

  return (
    <div className="ChatInfo" dir={!noRtl && lang.isRtl ? 'rtl' : undefined}>
      <Avatar
        key={chat.id}
        size={avatarSize}
        chat={chat}
        onClick={withMediaViewer ? handleAvatarViewerOpen : undefined}
      />
      <div className="info">
        <div className="title">
          <h3 dir="auto">{renderText(getChatTitle(lang, chat))}</h3>
          {chat.isVerified && <VerifiedIcon />}
          {chat.fakeType && <FakeIcon fakeType={chat.fakeType} />}
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
)(GroupChatInfo));
