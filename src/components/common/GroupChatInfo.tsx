import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiChat, ApiThreadInfo, ApiTopic, ApiTypingStatus,
} from '../../api/types';
import type { LangFn } from '../../hooks/useLang';
import { MediaViewerOrigin, type StoryViewerOrigin } from '../../types';

import {
  getChatTypeString,
  getMainUsername,
  isChatSuperGroup,
} from '../../global/helpers';
import {
  selectChat,
  selectChatMessages,
  selectChatOnlineCount,
  selectThreadInfo,
  selectThreadMessagesCount,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { REM } from './helpers/mediaDimensions';
import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Avatar from './Avatar';
import DotAnimation from './DotAnimation';
import FullNameTitle from './FullNameTitle';
import TopicIcon from './TopicIcon';
import TypingStatus from './TypingStatus';

const TOPIC_ICON_SIZE = 2.5 * REM;

type OwnProps = {
  chatId: string;
  threadId?: number;
  className?: string;
  typingStatus?: ApiTypingStatus;
  avatarSize?: 'tiny' | 'small' | 'medium' | 'large' | 'jumbo';
  status?: string;
  withDots?: boolean;
  withMediaViewer?: boolean;
  withUsername?: boolean;
  withFullInfo?: boolean;
  withUpdatingStatus?: boolean;
  withChatType?: boolean;
  noRtl?: boolean;
  noAvatar?: boolean;
  noStatusOrTyping?: boolean;
  withStory?: boolean;
  storyViewerOrigin?: StoryViewerOrigin;
  onClick?: VoidFunction;
};

type StateProps =
  {
    chat?: ApiChat;
    threadInfo?: ApiThreadInfo;
    topic?: ApiTopic;
    onlineCount?: number;
    areMessagesLoaded: boolean;
    messagesCount?: number;
  };

const GroupChatInfo: FC<OwnProps & StateProps> = ({
  typingStatus,
  className,
  avatarSize = 'medium',
  noAvatar,
  status,
  withDots,
  withMediaViewer,
  withUsername,
  withFullInfo,
  withUpdatingStatus,
  withChatType,
  threadInfo,
  noRtl,
  chat,
  onlineCount,
  areMessagesLoaded,
  topic,
  messagesCount,
  noStatusOrTyping,
  withStory,
  storyViewerOrigin,
  onClick,
}) => {
  const {
    loadFullChat,
    openMediaViewer,
    loadProfilePhotos,
  } = getActions();

  const lang = useLang();

  const isSuperGroup = chat && isChatSuperGroup(chat);
  const isTopic = Boolean(chat?.isForum && threadInfo && topic);
  const { id: chatId, isMin, isRestricted } = chat || {};

  useEffect(() => {
    if (chatId && !isMin) {
      if (withFullInfo) loadFullChat({ chatId });
      if (withMediaViewer) loadProfilePhotos({ profileId: chatId });
    }
  }, [chatId, isMin, withFullInfo, loadFullChat, loadProfilePhotos, isSuperGroup, withMediaViewer]);

  const handleAvatarViewerOpen = useLastCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>, hasMedia: boolean) => {
      if (chat && hasMedia) {
        e.stopPropagation();
        openMediaViewer({
          avatarOwnerId: chat.id,
          mediaId: 0,
          origin: avatarSize === 'jumbo' ? MediaViewerOrigin.ProfileAvatar : MediaViewerOrigin.MiddleHeaderAvatar,
        });
      }
    },
  );

  const mainUsername = useMemo(() => chat && withUsername && getMainUsername(chat), [chat, withUsername]);

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

    if (isTopic) {
      return (
        <span className="status" dir="auto">
          {messagesCount ? lang('messages', messagesCount, 'i') : renderText(chat.title)}
        </span>
      );
    }

    if (withChatType) {
      return (
        <span className="status" dir="auto">{lang(getChatTypeString(chat))}</span>
      );
    }

    const groupStatus = getGroupStatus(lang, chat);
    const onlineStatus = onlineCount ? `, ${lang('OnlineCount', onlineCount, 'i')}` : undefined;

    return (
      <span className="status">
        {mainUsername && <span className="handle">{mainUsername}</span>}
        <span className="group-status">{groupStatus}</span>
        {onlineStatus && <span className="online-status">{onlineStatus}</span>}
      </span>
    );
  }

  return (
    <div
      className={
        buildClassName('ChatInfo', className)
      }
      dir={!noRtl && lang.isRtl ? 'rtl' : undefined}
      onClick={onClick}
    >
      {!noAvatar && !isTopic && (
        <Avatar
          key={chat.id}
          size={avatarSize}
          peer={chat}
          withStory={withStory}
          storyViewerOrigin={storyViewerOrigin}
          storyViewerMode="single-peer"
          onClick={withMediaViewer ? handleAvatarViewerOpen : undefined}
        />
      )}
      {isTopic && (
        <TopicIcon
          topic={topic!}
          className="topic-header-icon"
          size={TOPIC_ICON_SIZE}
        />
      )}
      <div className="info">
        {topic
          ? <h3 dir="auto" className="fullName">{renderText(topic.title)}</h3>
          : <FullNameTitle peer={chat} />}
        {!noStatusOrTyping && renderStatusOrTyping()}
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
  (global, { chatId, threadId }): StateProps => {
    const chat = selectChat(global, chatId);
    const threadInfo = threadId ? selectThreadInfo(global, chatId, threadId) : undefined;
    const onlineCount = chat ? selectChatOnlineCount(global, chat) : undefined;
    const areMessagesLoaded = Boolean(selectChatMessages(global, chatId));
    const topic = threadId ? chat?.topics?.[threadId] : undefined;
    const messagesCount = topic && selectThreadMessagesCount(global, chatId, threadId!);

    return {
      chat,
      threadInfo,
      onlineCount,
      topic,
      areMessagesLoaded,
      messagesCount,
    };
  },
)(GroupChatInfo));
