import { memo, useEffect, useMemo } from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type {
  ApiChat, ApiTopic, ApiTypingStatus, ApiUser,
} from '../../api/types';
import type { IconName } from '../../types/icons';
import { MediaViewerOrigin, type StoryViewerOrigin, type ThreadId } from '../../types';

import {
  getChatTypeString,
  getGroupStatus,
  getMainUsername,
  isChatSuperGroup,
} from '../../global/helpers';
import {
  selectChat,
  selectChatMessages,
  selectChatOnlineCount,
  selectIsChatRestricted,
  selectMonoforumChannel,
  selectThreadMessagesCount,
  selectTopic,
  selectUser,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { REM } from './helpers/mediaDimensions';
import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Transition from '../ui/Transition';
import Avatar from './Avatar';
import DotAnimation from './DotAnimation';
import FullNameTitle from './FullNameTitle';
import Icon from './icons/Icon';
import TopicIcon from './TopicIcon';
import TypingStatus from './TypingStatus';

const TOPIC_ICON_SIZE = 2.5 * REM;

type OwnProps = {
  chatId: string;
  threadId?: ThreadId;
  className?: string;
  statusIcon?: IconName;
  typingStatus?: ApiTypingStatus;
  avatarSize?: 'tiny' | 'small' | 'medium' | 'large' | 'jumbo';
  status?: string;
  withDots?: boolean;
  withMediaViewer?: boolean;
  withUsername?: boolean;
  withFullInfo?: boolean;
  withUpdatingStatus?: boolean;
  withChatType?: boolean;
  noEmojiStatus?: boolean;
  emojiStatusSize?: number;
  noRtl?: boolean;
  noAvatar?: boolean;
  noStatusOrTyping?: boolean;
  withStory?: boolean;
  storyViewerOrigin?: StoryViewerOrigin;
  isSavedDialog?: boolean;
  withMonoforumStatus?: boolean;
  onClick?: VoidFunction;
  onEmojiStatusClick?: VoidFunction;
};

type StateProps = {
  chat?: ApiChat;
  topic?: ApiTopic;
  onlineCount?: number;
  areMessagesLoaded: boolean;
  messagesCount?: number;
  self?: ApiUser;
  monoforumChannel?: ApiChat;
};

const GroupChatInfo = ({
  typingStatus,
  className,
  statusIcon,
  avatarSize = 'medium',
  noAvatar,
  status,
  withDots,
  withMediaViewer,
  withUsername,
  withFullInfo,
  withUpdatingStatus,
  withChatType,
  noRtl,
  chat: realChat,
  onlineCount,
  areMessagesLoaded,
  topic,
  messagesCount,
  noStatusOrTyping,
  withStory,
  storyViewerOrigin,
  noEmojiStatus,
  emojiStatusSize,
  isSavedDialog,
  self,
  withMonoforumStatus,
  monoforumChannel,
  onClick,
  onEmojiStatusClick,
}: OwnProps & StateProps) => {
  const {
    loadFullChat,
    openMediaViewer,
    loadMoreProfilePhotos,
  } = getActions();

  const chat = !withMonoforumStatus && monoforumChannel ? monoforumChannel : realChat;

  const oldLang = useOldLang();
  const lang = useLang();

  const isSuperGroup = chat && isChatSuperGroup(chat);
  const isTopic = Boolean(chat?.isForum && topic);
  const { id: chatId, isMin } = chat || {};
  const isRestricted = selectIsChatRestricted(getGlobal(), chatId!);

  useEffect(() => {
    if (chatId && !isMin) {
      if (withFullInfo) loadFullChat({ chatId });
      if (withMediaViewer) loadMoreProfilePhotos({ peerId: chatId, isPreload: true });
    }
  }, [chatId, isMin, withFullInfo, isSuperGroup, withMediaViewer]);

  const handleAvatarViewerOpen = useLastCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>, hasMedia: boolean) => {
      if (chat && hasMedia) {
        e.stopPropagation();
        openMediaViewer({
          isAvatarView: true,
          chatId: chat.id,
          mediaIndex: 0,
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
    if (withUpdatingStatus && !areMessagesLoaded && !isRestricted) {
      return (
        <DotAnimation className="status" content={oldLang('Updating')} />
      );
    }

    if (withMonoforumStatus) {
      return (
        <span className="status" dir="auto">
          {lang('MonoforumStatus')}
        </span>
      );
    }

    if (realChat?.isMonoforum) {
      return undefined;
    }

    if (status) {
      return withDots ? (
        <DotAnimation className="status" content={status} />
      ) : (
        <span className="status" dir="auto">
          {statusIcon && <Icon className="status-icon" name={statusIcon} />}
          {renderText(status)}
        </span>
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
          <Transition
            name="fade"
            shouldRestoreHeight
            activeKey={messagesCount !== undefined ? 1 : 2}
            className="message-count-transition"
          >
            {messagesCount !== undefined ? oldLang('messages', messagesCount, 'i') : oldLang('lng_forum_no_messages')}
          </Transition>
        </span>
      );
    }

    if (withChatType) {
      return (
        <span className="status" dir="auto">{oldLang(getChatTypeString(chat))}</span>
      );
    }

    const groupStatus = getGroupStatus(oldLang, chat);
    const onlineStatus = onlineCount ? `, ${oldLang('OnlineCount', onlineCount, 'i')}` : undefined;

    return (
      <span className="status">
        {mainUsername && <span className="handle withStatus">{mainUsername}</span>}
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
        <>
          {isSavedDialog && self && (
            <Avatar
              key="saved-messages"
              size={avatarSize}
              peer={self}
              isSavedMessages
              className="saved-dialog-avatar"
            />
          )}
          <Avatar
            key={chat.id}
            className={buildClassName(isSavedDialog && 'overlay-avatar')}
            size={avatarSize}
            peer={chat}
            withStory={withStory}
            asMessageBubble={Boolean(monoforumChannel)}
            storyViewerOrigin={storyViewerOrigin}
            storyViewerMode="single-peer"
            isSavedDialog={isSavedDialog}
            onClick={withMediaViewer ? handleAvatarViewerOpen : undefined}
          />
        </>
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
          : (
            <FullNameTitle
              peer={chat}
              isMonoforum={!withMonoforumStatus && Boolean(monoforumChannel)}
              emojiStatusSize={emojiStatusSize}
              withEmojiStatus={!noEmojiStatus}
              isSavedDialog={isSavedDialog}
              onEmojiStatusClick={onEmojiStatusClick}
            />
          )}
        {!noStatusOrTyping && renderStatusOrTyping()}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId }): Complete<StateProps> => {
    const chat = selectChat(global, chatId);
    const onlineCount = chat ? selectChatOnlineCount(global, chat) : undefined;
    const areMessagesLoaded = Boolean(selectChatMessages(global, chatId));
    const topic = threadId ? selectTopic(global, chatId, threadId) : undefined;
    const messagesCount = topic && selectThreadMessagesCount(global, chatId, threadId!);
    const self = selectUser(global, global.currentUserId!);
    const monoforumChannel = selectMonoforumChannel(global, chatId);

    return {
      chat,
      onlineCount,
      topic,
      areMessagesLoaded,
      messagesCount,
      self,
      monoforumChannel,
    };
  },
)(GroupChatInfo));
