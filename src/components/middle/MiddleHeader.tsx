import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';
import cycleRestrict from '../../util/cycleRestrict';

import type { GlobalState, MessageListType } from '../../global/types';
import type {
  ApiChat, ApiMessage, ApiTypingStatus, ApiUser,
} from '../../api/types';
import { MAIN_THREAD_ID } from '../../api/types';

import {
  EDITABLE_INPUT_CSS_SELECTOR,
  MAX_SCREEN_WIDTH_FOR_EXPAND_PINNED_MESSAGES,
  MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN,
  MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN,
  MOBILE_SCREEN_MAX_WIDTH,
  SAFE_SCREEN_WIDTH_FOR_CHAT_INFO,
  SAFE_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN,
} from '../../config';
import { IS_SINGLE_COLUMN_LAYOUT, IS_TABLET_COLUMN_LAYOUT } from '../../util/environment';
import {
  getChatTitle, getMessageKey, getSenderTitle, isChatChannel, isChatSuperGroup, isUserId,
} from '../../global/helpers';
import {
  selectAllowedMessageActions,
  selectChat,
  selectChatMessage,
  selectChatMessages,
  selectForwardedSender,
  selectIsChatBotNotStarted,
  selectIsChatWithBot,
  selectIsChatWithSelf,
  selectIsInSelectMode,
  selectIsRightColumnShown,
  selectIsUserBlocked,
  selectPinnedIds,
  selectScheduledIds,
  selectThreadInfo,
  selectThreadTopMessageId,
} from '../../global/selectors';
import useEnsureMessage from '../../hooks/useEnsureMessage';
import useWindowSize from '../../hooks/useWindowSize';
import useShowTransition from '../../hooks/useShowTransition';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';
import useConnectionStatus from '../../hooks/useConnectionStatus';

import PrivateChatInfo from '../common/PrivateChatInfo';
import GroupChatInfo from '../common/GroupChatInfo';
import UnreadCounter from '../common/UnreadCounter';
import Transition from '../ui/Transition';
import Button from '../ui/Button';
import HeaderActions from './HeaderActions';
import HeaderPinnedMessage from './HeaderPinnedMessage';
import AudioPlayer from './AudioPlayer';
import GroupCallTopPane from '../calls/group/GroupCallTopPane';
import ChatReportPanel from './ChatReportPanel';

import './MiddleHeader.scss';

const ANIMATION_DURATION = 350;
const BACK_BUTTON_INACTIVE_TIME = 450;

type OwnProps = {
  chatId: string;
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
  messagesCount?: number;
  isChatWithSelf?: boolean;
  lastSyncTime?: number;
  hasButtonInHeader?: boolean;
  shouldSkipHistoryAnimations?: boolean;
  currentTransitionKey: number;
  connectionState?: GlobalState['connectionState'];
  isSyncing?: GlobalState['isSyncing'];
};

const MiddleHeader: FC<OwnProps & StateProps> = ({
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
  messagesCount,
  isChatWithSelf,
  lastSyncTime,
  hasButtonInHeader,
  shouldSkipHistoryAnimations,
  currentTransitionKey,
  connectionState,
  isSyncing,
}) => {
  const {
    openChatWithInfo,
    pinMessage,
    focusMessage,
    openChat,
    openPreviousChat,
    loadPinnedMessages,
    toggleLeftColumn,
    exitMessageSelectMode,
  } = getActions();

  const lang = useLang();
  const isBackButtonActive = useRef(true);

  const [pinnedMessageIndex, setPinnedMessageIndex] = useState(0);
  const pinnedMessageId = Array.isArray(pinnedMessageIds) ? pinnedMessageIds[pinnedMessageIndex] : pinnedMessageIds;
  const pinnedMessage = messagesById && pinnedMessageId ? messagesById[pinnedMessageId] : undefined;
  const pinnedMessagesCount = Array.isArray(pinnedMessageIds)
    ? pinnedMessageIds.length : (pinnedMessageIds ? 1 : undefined);
  const chatTitleLength = chat && getChatTitle(lang, chat).length;
  const topMessageTitle = topMessageSender ? getSenderTitle(lang, topMessageSender) : undefined;
  const { settings } = chat || {};

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

      const newIndex = cycleRestrict(pinnedMessagesCount || 1, pinnedMessageIndex + 1);
      setPinnedMessageIndex(newIndex);
    }
  }, [pinnedMessage, focusMessage, threadId, pinnedMessagesCount, pinnedMessageIndex]);

  const handleAllPinnedClick = useCallback(() => {
    openChat({ id: chatId, threadId: MAIN_THREAD_ID, type: 'pinned' });
  }, [openChat, chatId]);

  const setBackButtonActive = useCallback(() => {
    setTimeout(() => {
      isBackButtonActive.current = true;
    }, BACK_BUTTON_INACTIVE_TIME);
  }, []);

  const handleBackClick = useCallback((e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    if (!isBackButtonActive.current) return;

    // Workaround for missing UI when quickly clicking the Back button
    isBackButtonActive.current = false;
    if (IS_SINGLE_COLUMN_LAYOUT) {
      const messageInput = document.querySelector<HTMLDivElement>(EDITABLE_INPUT_CSS_SELECTOR);
      messageInput?.blur();
    }

    if (isSelectModeActive) {
      exitMessageSelectMode();
      setBackButtonActive();
      return;
    }

    if (threadId === MAIN_THREAD_ID && messageListType === 'thread' && currentTransitionKey === 0) {
      if (IS_SINGLE_COLUMN_LAYOUT || shouldShowCloseButton) {
        e.stopPropagation(); // Stop propagation to prevent chat re-opening on tablets
        openChat({ id: undefined }, { forceOnHeavyAnimation: true });
      } else {
        toggleLeftColumn();
      }

      setBackButtonActive();

      return;
    }

    openPreviousChat();
    setBackButtonActive();
  }, [
    threadId, messageListType, currentTransitionKey, isSelectModeActive, openPreviousChat, shouldShowCloseButton,
    openChat, toggleLeftColumn, exitMessageSelectMode, setBackButtonActive,
  ]);

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

  const hasChatSettings = Boolean(settings?.canAddContact || settings?.canBlockContact || settings?.canReportSpam);
  const {
    shouldRender: shouldShowChatReportPanel,
    transitionClassNames: chatReportPanelClassNames,
  } = useShowTransition(hasChatSettings);
  const renderingChatSettings = useCurrentOrPrev(hasChatSettings ? settings : undefined, true);

  const {
    shouldRender: shouldRenderAudioPlayer,
    transitionClassNames: audioPlayerClassNames,
  } = useShowTransition(Boolean(audioMessage));

  const renderingAudioMessage = useCurrentOrPrev(audioMessage, true);

  const {
    shouldRender: shouldRenderPinnedMessage,
    transitionClassNames: pinnedMessageClassNames,
  } = useShowTransition(Boolean(pinnedMessage));

  const renderingPinnedMessage = useCurrentOrPrev(pinnedMessage, true);
  const renderingPinnedMessagesCount = useCurrentOrPrev(pinnedMessagesCount, true);
  const renderingCanUnpin = useCurrentOrPrev(canUnpin, true);
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

  const { connectionStatusText } = useConnectionStatus(lang, connectionState, isSyncing, true);

  function renderInfo() {
    return (
      messageListType === 'thread' && threadId === MAIN_THREAD_ID ? (
        renderMainThreadInfo()
      ) : messageListType === 'thread' ? (
        <>
          {renderBackButton()}
          <h3>
            {lang('CommentsCount', messagesCount, 'i')}
          </h3>
        </>
      ) : messageListType === 'pinned' ? (
        <>
          {renderBackButton()}
          <h3>
            {lang('PinnedMessagesCount', messagesCount, 'i')}
          </h3>
        </>
      ) : messageListType === 'scheduled' ? (
        <>
          {renderBackButton()}
          <h3>
            {isChatWithSelf ? lang('Reminders') : lang('messages', messagesCount, 'i')}
          </h3>
        </>
      ) : undefined
    );
  }

  function renderMainThreadInfo() {
    return (
      <>
        {(isLeftColumnHideable || currentTransitionKey > 0) && renderBackButton(shouldShowCloseButton, true)}
        <div className="chat-info-wrapper" onClick={handleHeaderClick}>
          {isUserId(chatId) ? (
            <PrivateChatInfo
              userId={chatId}
              typingStatus={typingStatus}
              status={connectionStatusText}
              withDots={Boolean(connectionStatusText)}
              withFullInfo
              withMediaViewer
              withUpdatingStatus
              withVideoAvatar={isReady}
              noRtl
            />
          ) : (
            <GroupChatInfo
              chatId={chatId}
              typingStatus={typingStatus}
              status={connectionStatusText}
              withDots={Boolean(connectionStatusText)}
              withMediaViewer
              withFullInfo
              withUpdatingStatus
              withVideoAvatar={isReady}
              noRtl
            />
          )}
        </div>
      </>
    );
  }

  function renderBackButton(asClose = false, withUnreadCounter = false) {
    return (
      <div className="back-button">
        <Button
          round
          size="smaller"
          color="translucent"
          onClick={handleBackClick}
          ariaLabel={lang(asClose ? 'Close' : 'Back')}
        >
          <div className={buildClassName('animated-close-icon', !asClose && 'state-back')} />
        </Button>
        {withUnreadCounter && <UnreadCounter />}
      </div>
    );
  }

  const isAudioPlayerRendered = Boolean(shouldRenderAudioPlayer && renderingAudioMessage);
  const isPinnedMessagesFullWidth = isAudioPlayerRendered
    || (!IS_SINGLE_COLUMN_LAYOUT && hasButtonInHeader && windowWidth < MAX_SCREEN_WIDTH_FOR_EXPAND_PINNED_MESSAGES);

  return (
    <div className="MiddleHeader" ref={componentRef}>
      <Transition
        name={shouldSkipHistoryAnimations ? 'none' : 'slide-fade'}
        activeKey={currentTransitionKey}
      >
        {renderInfo()}
      </Transition>

      <GroupCallTopPane
        hasPinnedOffset={
          (shouldRenderPinnedMessage && Boolean(renderingPinnedMessage))
          || (shouldRenderAudioPlayer && Boolean(renderingAudioMessage))
        }
        chatId={chatId}
      />

      {shouldRenderPinnedMessage && renderingPinnedMessage && (
        <HeaderPinnedMessage
          key={chatId}
          message={renderingPinnedMessage}
          count={renderingPinnedMessagesCount || 0}
          index={pinnedMessageIndex}
          customTitle={renderingPinnedMessageTitle}
          className={buildClassName(pinnedMessageClassNames, isPinnedMessagesFullWidth && 'full-width')}
          onUnpinMessage={renderingCanUnpin ? handleUnpinMessage : undefined}
          onClick={handlePinnedMessageClick}
          onAllPinnedClick={handleAllPinnedClick}
        />
      )}

      {shouldShowChatReportPanel && (
        <ChatReportPanel
          key={chatId}
          chatId={chatId}
          settings={renderingChatSettings}
          className={chatReportPanelClassNames}
        />
      )}

      <div className="header-tools">
        {isAudioPlayerRendered && (
          <AudioPlayer
            key={getMessageKey(renderingAudioMessage!)}
            message={renderingAudioMessage!}
            className={audioPlayerClassNames}
          />
        )}
        <HeaderActions
          chatId={chatId}
          threadId={threadId}
          messageListType={messageListType}
          canExpandActions={!isAudioPlayerRendered}
        />
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, threadId, messageListType }): StateProps => {
    const { isLeftColumnShown, lastSyncTime, shouldSkipHistoryAnimations } = global;
    const chat = selectChat(global, chatId);
    const { typingStatus } = chat || {};

    const { chatId: audioChatId, messageId: audioMessageId } = global.audioPlayer;
    const audioMessage = audioChatId && audioMessageId
      ? selectChatMessage(global, audioChatId, audioMessageId)
      : undefined;

    let messagesCount: number | undefined;
    if (messageListType === 'pinned') {
      const pinnedIds = selectPinnedIds(global, chatId);
      messagesCount = pinnedIds?.length;
    } else if (messageListType === 'scheduled') {
      const scheduledIds = selectScheduledIds(global, chatId);
      messagesCount = scheduledIds?.length;
    } else if (messageListType === 'thread' && threadId !== MAIN_THREAD_ID) {
      const threadInfo = selectThreadInfo(global, chatId, threadId);
      messagesCount = threadInfo?.messagesCount || 0;
    }

    const isMainThread = messageListType === 'thread' && threadId === MAIN_THREAD_ID;
    const isChatWithBot = chat && selectIsChatWithBot(global, chat);
    const canRestartBot = Boolean(isChatWithBot && selectIsUserBlocked(global, chatId));
    const canStartBot = isChatWithBot && !canRestartBot && Boolean(selectIsChatBotNotStarted(global, chatId));
    const canSubscribe = Boolean(
      isMainThread && chat && (isChatChannel(chat) || isChatSuperGroup(chat)) && chat.isNotJoined,
    );
    const shouldSendJoinRequest = Boolean(chat?.isNotJoined && chat.isJoinRequest);

    const state: StateProps = {
      typingStatus,
      isLeftColumnShown,
      isRightColumnShown: selectIsRightColumnShown(global),
      isSelectModeActive: selectIsInSelectMode(global),
      audioMessage,
      chat,
      messagesCount,
      isChatWithSelf: selectIsChatWithSelf(global, chatId),
      lastSyncTime,
      shouldSkipHistoryAnimations,
      currentTransitionKey: Math.max(0, global.messages.messageLists.length - 1),
      connectionState: global.connectionState,
      isSyncing: global.isSyncing,
      hasButtonInHeader: canStartBot || canRestartBot || canSubscribe || shouldSendJoinRequest,
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
    if (pinnedMessageIds?.length) {
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
)(MiddleHeader));
