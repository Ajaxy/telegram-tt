import React, {
  FC, useCallback, useMemo, memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';
import cycleRestrict from '../../util/cycleRestrict';

import { GlobalActions, MessageListType } from '../../global/types';
import {
  ApiMessage,
  ApiChat,
  ApiTypingStatus,
  MAIN_THREAD_ID, ApiUser,
} from '../../api/types';
import { NotifyException, NotifySettings } from '../../types';

import {
  MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN,
  MOBILE_SCREEN_MAX_WIDTH,
  EDITABLE_INPUT_ID,
  MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN,
  SAFE_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN,
  SAFE_SCREEN_WIDTH_FOR_CHAT_INFO,
} from '../../config';
import { IS_SINGLE_COLUMN_LAYOUT, IS_TABLET_COLUMN_LAYOUT } from '../../util/environment';
import {
  isChatPrivate,
  isChatArchived,
  getMessageKey,
  getChatTitle,
  getSenderTitle,
  selectIsChatMuted,
} from '../../modules/helpers';
import {
  selectChat,
  selectChatMessage,
  selectAllowedMessageActions,
  selectIsRightColumnShown,
  selectThreadTopMessageId,
  selectThreadInfo,
  selectChatMessages,
  selectPinnedIds,
  selectIsChatWithSelf,
  selectForwardedSender,
  selectScheduledIds,
  selectIsInSelectMode,
  selectIsChatWithBot,
  selectNotifySettings,
  selectNotifyExceptions,
} from '../../modules/selectors';
import useEnsureMessage from '../../hooks/useEnsureMessage';
import useWindowSize from '../../hooks/useWindowSize';
import useShowTransition from '../../hooks/useShowTransition';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import { pick } from '../../util/iteratees';
import { formatIntegerCompact } from '../../util/textFormat';
import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

import PrivateChatInfo from '../common/PrivateChatInfo';
import GroupChatInfo from '../common/GroupChatInfo';
import Transition from '../ui/Transition';
import Button from '../ui/Button';
import HeaderActions from './HeaderActions';
import HeaderPinnedMessage from './HeaderPinnedMessage';
import AudioPlayer from './AudioPlayer';

import './MiddleHeader.scss';

const ANIMATION_DURATION = 350;

type OwnProps = {
  chatId: number;
  threadId: number;
  messageListType: MessageListType;
  isReady?: boolean;
};

type StateProps = {
  chat?: ApiChat;
  pinnedMessageIds?: number[] | number;
  messagesById?: Record<number, ApiMessage>;
  canUnpin?: boolean;
  topMessageSender?: ApiChat | ApiUser;
  typingStatus?: ApiTypingStatus;
  isSelectModeActive?: boolean;
  isLeftColumnShown?: boolean;
  isRightColumnShown?: boolean;
  audioMessage?: ApiMessage;
  chatsById?: Record<number, ApiChat>;
  messagesCount?: number;
  isChatWithSelf?: boolean;
  isChatWithBot?: boolean;
  lastSyncTime?: number;
  notifySettings: NotifySettings;
  notifyExceptions?: Record<number, NotifyException>;
  shouldSkipHistoryAnimations?: boolean;
  currentTransitionKey: number;
};

type DispatchProps = Pick<GlobalActions, (
  'openChatWithInfo' | 'pinMessage' | 'focusMessage' | 'openChat' | 'openPreviousChat' | 'loadPinnedMessages' |
  'toggleLeftColumn' | 'exitMessageSelectMode'
)>;

const MiddleHeader: FC<OwnProps & StateProps & DispatchProps> = ({
  chatId,
  threadId,
  messageListType,
  isReady,
  pinnedMessageIds,
  messagesById,
  canUnpin,
  topMessageSender,
  typingStatus,
  isSelectModeActive,
  isLeftColumnShown,
  isRightColumnShown,
  audioMessage,
  chat,
  chatsById,
  messagesCount,
  isChatWithSelf,
  isChatWithBot,
  lastSyncTime,
  notifySettings,
  notifyExceptions,
  shouldSkipHistoryAnimations,
  currentTransitionKey,
  openChatWithInfo,
  pinMessage,
  focusMessage,
  openChat,
  openPreviousChat,
  loadPinnedMessages,
  toggleLeftColumn,
  exitMessageSelectMode,
}) => {
  const lang = useLang();

  const [pinnedMessageIndex, setPinnedMessageIndex] = useState(0);
  const pinnedMessageId = Array.isArray(pinnedMessageIds) ? pinnedMessageIds[pinnedMessageIndex] : pinnedMessageIds;
  const pinnedMessage = messagesById && pinnedMessageId ? messagesById[pinnedMessageId] : undefined;
  const pinnedMessagesCount = Array.isArray(pinnedMessageIds) ? pinnedMessageIds.length : (pinnedMessageIds ? 1 : 0);
  const chatTitleLength = chat && getChatTitle(lang, chat).length;
  const topMessageTitle = topMessageSender ? getSenderTitle(lang, topMessageSender) : undefined;

  useEffect(() => {
    if (threadId === MAIN_THREAD_ID && lastSyncTime && isReady) {
      loadPinnedMessages({ chatId });
    }
  }, [chatId, loadPinnedMessages, lastSyncTime, threadId, isReady]);

  // Reset pinned index when switching chats and pinning/unpinning
  useEffect(() => {
    setPinnedMessageIndex(0);
  }, [pinnedMessageIds]);

  useEnsureMessage(chatId, pinnedMessageId, pinnedMessage);

  const { width: windowWidth } = useWindowSize();

  const isLeftColumnHideable = windowWidth <= MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN;
  const shouldShowCloseButton = IS_TABLET_COLUMN_LAYOUT && isLeftColumnShown;

  // eslint-disable-next-line no-null/no-null
  const componentRef = useRef<HTMLDivElement>(null);
  const shouldAnimateTools = useRef<boolean>(true);

  const handleHeaderClick = useCallback(() => {
    openChatWithInfo({ id: chatId });
  }, [openChatWithInfo, chatId]);

  const handleUnpinMessage = useCallback((messageId: number) => {
    pinMessage({ chatId, messageId, isUnpin: true });
  }, [pinMessage, chatId]);

  const handlePinnedMessageClick = useCallback((): void => {
    if (pinnedMessage) {
      focusMessage({ chatId: pinnedMessage.chatId, threadId, messageId: pinnedMessage.id });

      const newIndex = cycleRestrict(pinnedMessagesCount, pinnedMessageIndex + 1);
      setPinnedMessageIndex(newIndex);
    }
  }, [pinnedMessage, focusMessage, threadId, pinnedMessagesCount, pinnedMessageIndex]);

  const handleAllPinnedClick = useCallback(() => {
    openChat({ id: chatId, threadId: MAIN_THREAD_ID, type: 'pinned' });
  }, [openChat, chatId]);

  const handleBackClick = useCallback((e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    if (IS_SINGLE_COLUMN_LAYOUT) {
      const messageInput = document.getElementById(EDITABLE_INPUT_ID);
      if (messageInput) {
        messageInput.blur();
      }
    }

    if (threadId === MAIN_THREAD_ID && messageListType === 'thread' && currentTransitionKey === 0) {
      if (IS_SINGLE_COLUMN_LAYOUT || shouldShowCloseButton) {
        e.stopPropagation(); // Stop propagation to prevent chat re-opening on tablets
        openChat({ id: undefined });
      } else {
        toggleLeftColumn();
      }

      return;
    }

    if (messageListType === 'scheduled' && isSelectModeActive) {
      exitMessageSelectMode();
    }

    openPreviousChat();
  }, [
    threadId, messageListType, currentTransitionKey, isSelectModeActive, openPreviousChat, shouldShowCloseButton,
    openChat, toggleLeftColumn, exitMessageSelectMode,
  ]);

  const unreadCount = useMemo(() => {
    if (!isLeftColumnHideable || !chatsById) {
      return undefined;
    }

    let isActive = false;

    const totalCount = Object.values(chatsById).reduce((total, currentChat) => {
      if (isChatArchived(currentChat)) {
        return total;
      }

      const count = currentChat.unreadCount || 0;
      if (
        count && (!selectIsChatMuted(currentChat, notifySettings, notifyExceptions) || currentChat.unreadMentionsCount)
      ) {
        isActive = true;
      }

      return total + count;
    }, 0);

    if (!totalCount) {
      return undefined;
    }

    return {
      isActive,
      totalCount,
    };
  }, [isLeftColumnHideable, chatsById, notifySettings, notifyExceptions]);

  const canToolsCollideWithChatInfo = (
    windowWidth >= MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN
    && windowWidth < SAFE_SCREEN_WIDTH_FOR_CHAT_INFO
  ) || (
    windowWidth > MOBILE_SCREEN_MAX_WIDTH
    && windowWidth < MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN
    && (!chatTitleLength || chatTitleLength > 30)
  );
  const shouldUseStackedToolsClass = canToolsCollideWithChatInfo || (
    windowWidth > MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN
    && windowWidth < SAFE_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN
  );

  const {
    shouldRender: shouldRenderAudioPlayer,
    transitionClassNames: audioPlayerClassNames,
  } = useShowTransition(Boolean(audioMessage));

  const renderingAudioMessage = useCurrentOrPrev(audioMessage);

  const {
    shouldRender: shouldRenderPinnedMessage,
    transitionClassNames: pinnedMessageClassNames,
  } = useShowTransition(pinnedMessage && !shouldRenderAudioPlayer);

  const renderingPinnedMessage = useCurrentOrPrev(pinnedMessage);
  const renderingPinnedMessageTitle = useCurrentOrPrev(topMessageTitle);

  const canRevealTools = (shouldRenderPinnedMessage && renderingPinnedMessage)
    || (shouldRenderAudioPlayer && renderingAudioMessage);

  // Logic for transition to and from custom display of AudioPlayer/PinnedMessage on smaller screens
  useEffect(() => {
    const componentEl = componentRef.current;
    if (!componentEl) {
      return;
    }

    if (!shouldUseStackedToolsClass || !canRevealTools) {
      componentEl.classList.remove('tools-stacked', 'animated');
      shouldAnimateTools.current = true;
      return;
    }

    if (isRightColumnShown || canToolsCollideWithChatInfo) {
      if (shouldAnimateTools.current) {
        componentEl.classList.add('tools-stacked', 'animated');
        shouldAnimateTools.current = false;
      }

      // Remove animation class to prevent it messing up the show transitions
      setTimeout(() => {
        componentEl.classList.remove('animated');
      }, ANIMATION_DURATION);
    } else {
      componentEl.classList.remove('tools-stacked');
      shouldAnimateTools.current = true;
    }
  }, [shouldUseStackedToolsClass, canRevealTools, canToolsCollideWithChatInfo, isRightColumnShown]);

  function renderInfo() {
    return (
      messageListType === 'thread' && threadId === MAIN_THREAD_ID ? (
        renderMainThreadInfo()
      ) : messageListType === 'thread' ? (
        <>
          {renderBackButton()}
          <h3>
            {lang('CommentsCount', messagesCount)}
          </h3>
        </>
      ) : messageListType === 'pinned' ? (
        <>
          {renderBackButton()}
          <h3>
            {lang('PinnedMessagesCount', messagesCount)}
          </h3>
        </>
      ) : messageListType === 'scheduled' ? (
        <>
          {renderBackButton()}
          <h3>
            {isChatWithSelf ? lang('Reminders') : lang('messages', messagesCount)}
          </h3>
        </>
      ) : undefined
    );
  }

  function renderMainThreadInfo() {
    return (
      <>
        {(isLeftColumnHideable || currentTransitionKey > 0) && renderBackButton(shouldShowCloseButton, unreadCount)}
        <div className="chat-info-wrapper" onClick={handleHeaderClick}>
          {isChatPrivate(chatId) ? (
            <PrivateChatInfo
              userId={chatId}
              typingStatus={typingStatus}
              withFullInfo={isChatWithBot}
              withMediaViewer
              withUpdatingStatus
              noRtl
            />
          ) : (
            <GroupChatInfo
              chatId={chatId}
              typingStatus={typingStatus}
              noRtl
              withMediaViewer
              withFullInfo
              withUpdatingStatus
            />
          )}
        </div>
      </>
    );
  }

  function renderBackButton(asClose = false, unreadCountInfo?: typeof unreadCount) {
    return (
      <div className="back-button">
        <Button
          round
          size="smaller"
          color="translucent"
          onClick={handleBackClick}
          ariaLabel={asClose ? 'Close' : 'Back'}
        >
          <div className={buildClassName('animated-close-icon', !asClose && 'state-back')} />
        </Button>
        {unreadCountInfo && (
          <div className={`unread-count ${unreadCountInfo.isActive ? 'active' : ''}`}>
            {formatIntegerCompact(unreadCountInfo.totalCount)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="MiddleHeader" ref={componentRef}>
      <Transition
        name={shouldSkipHistoryAnimations ? 'none' : 'slide-fade'}
        activeKey={currentTransitionKey}
      >
        {renderInfo}
      </Transition>

      <div className="header-tools">
        {shouldRenderPinnedMessage && renderingPinnedMessage && !shouldRenderAudioPlayer && (
          <HeaderPinnedMessage
            key={chatId}
            message={renderingPinnedMessage}
            count={pinnedMessagesCount}
            index={pinnedMessageIndex}
            customTitle={renderingPinnedMessageTitle}
            className={pinnedMessageClassNames}
            onUnpinMessage={canUnpin ? handleUnpinMessage : undefined}
            onClick={handlePinnedMessageClick}
            onAllPinnedClick={handleAllPinnedClick}
          />
        )}
        {shouldRenderAudioPlayer && renderingAudioMessage && (
          <AudioPlayer
            key={getMessageKey(renderingAudioMessage)}
            message={renderingAudioMessage!}
            className={audioPlayerClassNames}
          />
        )}
        <HeaderActions
          chatId={chatId}
          threadId={threadId}
          messageListType={messageListType}
        />
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId, messageListType }): StateProps => {
    const { isLeftColumnShown, lastSyncTime, shouldSkipHistoryAnimations } = global;
    const { byId: chatsById } = global.chats;
    const chat = selectChat(global, chatId);

    const { typingStatus } = chat || {};

    const { chatId: audioChatId, messageId: audioMessageId } = global.audioPlayer;
    const audioMessage = audioChatId && audioMessageId
      ? selectChatMessage(global, audioChatId, audioMessageId)
      : undefined;

    let messagesCount: number | undefined;
    if (messageListType === 'pinned') {
      const pinnedIds = selectPinnedIds(global, chatId);
      messagesCount = pinnedIds && pinnedIds.length;
    } else if (messageListType === 'scheduled') {
      const scheduledIds = selectScheduledIds(global, chatId);
      messagesCount = scheduledIds && scheduledIds.length;
    } else if (messageListType === 'thread' && threadId !== MAIN_THREAD_ID) {
      const threadInfo = selectThreadInfo(global, chatId, threadId);
      if (threadInfo) {
        messagesCount = threadInfo.messagesCount;
      }
    }

    const state: StateProps = {
      typingStatus,
      isLeftColumnShown,
      isRightColumnShown: selectIsRightColumnShown(global),
      isSelectModeActive: selectIsInSelectMode(global),
      audioMessage,
      chat,
      chatsById,
      messagesCount,
      isChatWithSelf: selectIsChatWithSelf(global, chatId),
      isChatWithBot: chat && selectIsChatWithBot(global, chat),
      lastSyncTime,
      notifySettings: selectNotifySettings(global),
      notifyExceptions: selectNotifyExceptions(global),
      shouldSkipHistoryAnimations,
      currentTransitionKey: Math.max(0, global.messages.messageLists.length - 1),
    };

    const messagesById = selectChatMessages(global, chatId);
    if (messageListType !== 'thread' || !messagesById) {
      return state;
    }

    Object.assign(state, { messagesById });

    if (threadId !== MAIN_THREAD_ID) {
      const pinnedMessageId = selectThreadTopMessageId(global, chatId, threadId);
      const message = pinnedMessageId ? selectChatMessage(global, chatId, pinnedMessageId) : undefined;
      const topMessageSender = message ? selectForwardedSender(global, message) : undefined;

      return {
        ...state,
        pinnedMessageIds: pinnedMessageId,
        canUnpin: false,
        topMessageSender,
      };
    }

    const pinnedMessageIds = selectPinnedIds(global, chatId);
    if (pinnedMessageIds && pinnedMessageIds.length) {
      const firstPinnedMessage = messagesById[pinnedMessageIds[0]];
      const {
        canUnpin,
      } = (firstPinnedMessage && selectAllowedMessageActions(global, firstPinnedMessage, threadId)) || {};

      return {
        ...state,
        pinnedMessageIds,
        canUnpin,
      };
    }

    return state;
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'openChatWithInfo',
    'pinMessage',
    'focusMessage',
    'openChat',
    'openPreviousChat',
    'loadPinnedMessages',
    'toggleLeftColumn',
    'exitMessageSelectMode',
  ]),
)(MiddleHeader));
