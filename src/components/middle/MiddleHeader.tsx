import React, {
  memo, useEffect, useLayoutEffect, useRef,
} from '../../lib/teact/teact';
import { requestMutation } from '../../lib/fasterdom/fasterdom';
import { getActions, withGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { GlobalState, MessageListType } from '../../global/types';
import type { Signal } from '../../util/signals';
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
import {
  getChatTitle, getMessageKey, getSenderTitle, isChatChannel, isChatSuperGroup, isUserId,
} from '../../global/helpers';
import {
  selectAllowedMessageActions,
  selectChat,
  selectChatMessage,
  selectChatMessages,
  selectTabState,
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
  selectThreadParam,
  selectThreadTopMessageId,
} from '../../global/selectors';
import cycleRestrict from '../../util/cycleRestrict';

import useLastCallback from '../../hooks/useLastCallback';
import { useFastClick } from '../../hooks/useFastClick';
import useEnsureMessage from '../../hooks/useEnsureMessage';
import useWindowSize from '../../hooks/useWindowSize';
import useShowTransition from '../../hooks/useShowTransition';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import usePrevious from '../../hooks/usePrevious';
import useElectronDrag from '../../hooks/useElectronDrag';
import useAppLayout from '../../hooks/useAppLayout';
import useDerivedState from '../../hooks/useDerivedState';

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
const EMOJI_STATUS_SIZE = 22;

type OwnProps = {
  chatId: string;
  threadId: number;
  messageListType: MessageListType;
  isReady?: boolean;
  isMobile?: boolean;
  getCurrentPinnedIndexes: Signal<Record<string, number>>;
  getLoadingPinnedId: Signal<number | undefined>;
  onFocusPinnedMessage: (messageId: number) => boolean;
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
  isComments?: boolean;
  isChatWithSelf?: boolean;
  hasButtonInHeader?: boolean;
  shouldSkipHistoryAnimations?: boolean;
  currentTransitionKey: number;
  connectionState?: GlobalState['connectionState'];
  isSyncing?: boolean;
  isSynced?: boolean;
  isFetchingDifference?: boolean;
};

const MiddleHeader: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  messageListType,
  isReady,
  isMobile,
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
  isComments,
  isChatWithSelf,
  hasButtonInHeader,
  shouldSkipHistoryAnimations,
  currentTransitionKey,
  connectionState,
  isSyncing,
  isSynced,
  isFetchingDifference,
  getCurrentPinnedIndexes,
  getLoadingPinnedId,
  onFocusPinnedMessage,
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
  const { isTablet } = useAppLayout();

  const currentPinnedIndexes = useDerivedState(getCurrentPinnedIndexes);
  const currentPinnedIndex = currentPinnedIndexes[`${chatId}_${threadId}`] || 0;
  const waitingForPinnedId = useDerivedState(getLoadingPinnedId);
  const pinnedMessageId = Array.isArray(pinnedMessageIds) ? pinnedMessageIds[currentPinnedIndex] : pinnedMessageIds;
  const pinnedMessage = messagesById && pinnedMessageId ? messagesById[pinnedMessageId] : undefined;
  const pinnedMessagesCount = Array.isArray(pinnedMessageIds)
    ? pinnedMessageIds.length : (pinnedMessageIds ? 1 : undefined);
  const chatTitleLength = chat && getChatTitle(lang, chat).length;
  const topMessageTitle = topMessageSender ? getSenderTitle(lang, topMessageSender) : undefined;
  const { settings } = chat || {};
  const isForum = chat?.isForum;

  useEffect(() => {
    if (isSynced && isReady && (threadId === MAIN_THREAD_ID || isForum)) {
      loadPinnedMessages({ chatId, threadId });
    }
  }, [chatId, threadId, isSynced, isReady, isForum]);

  useEnsureMessage(chatId, pinnedMessageId, pinnedMessage);

  const { width: windowWidth } = useWindowSize();

  const isLeftColumnHideable = windowWidth <= MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN;
  const shouldShowCloseButton = isTablet && isLeftColumnShown;

  // eslint-disable-next-line no-null/no-null
  const componentRef = useRef<HTMLDivElement>(null);
  const shouldAnimateTools = useRef<boolean>(true);

  const { handleClick: handleHeaderClick, handleMouseDown: handleHeaderMouseDown } = useFastClick(() => {
    openChatWithInfo({ id: chatId, threadId });
  });

  const handleUnpinMessage = useLastCallback((messageId: number) => {
    pinMessage({ messageId, isUnpin: true });
  });

  const handlePinnedMessageClick = useLastCallback((e: React.MouseEvent<HTMLElement, MouseEvent>): void => {
    const messageId = e.shiftKey && Array.isArray(pinnedMessageIds)
      ? pinnedMessageIds[cycleRestrict(pinnedMessageIds.length, pinnedMessageIds.indexOf(pinnedMessageId!) - 2)]
      : pinnedMessageId!;

    if (onFocusPinnedMessage(messageId)) {
      focusMessage({
        chatId, threadId, messageId, noForumTopicPanel: true,
      });
    }
  });

  const handleAllPinnedClick = useLastCallback(() => {
    openChat({ id: chatId, threadId, type: 'pinned' });
  });

  const setBackButtonActive = useLastCallback(() => {
    setTimeout(() => {
      isBackButtonActive.current = true;
    }, BACK_BUTTON_INACTIVE_TIME);
  });

  const handleBackClick = useLastCallback((e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    if (!isBackButtonActive.current) return;

    // Workaround for missing UI when quickly clicking the Back button
    isBackButtonActive.current = false;
    if (isMobile) {
      const messageInput = document.querySelector<HTMLDivElement>(EDITABLE_INPUT_CSS_SELECTOR);
      messageInput?.blur();
    }

    if (isSelectModeActive) {
      exitMessageSelectMode();
      setBackButtonActive();
      return;
    }

    if (messageListType === 'thread' && currentTransitionKey === 0) {
      if (!isTablet || shouldShowCloseButton) {
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
  });

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
  } = useShowTransition(Boolean(pinnedMessage), undefined, true);

  const renderingPinnedMessage = useCurrentOrPrev(pinnedMessage, true);
  const renderingPinnedMessagesCount = useCurrentOrPrev(pinnedMessagesCount, true);
  const renderingCanUnpin = useCurrentOrPrev(canUnpin, true);
  const renderingPinnedMessageTitle = useCurrentOrPrev(topMessageTitle);

  const prevTransitionKey = usePrevious(currentTransitionKey);
  const cleanupExceptionKey = (
    prevTransitionKey !== undefined && prevTransitionKey < currentTransitionKey ? prevTransitionKey : undefined
  );

  const canRevealTools = (shouldRenderPinnedMessage && renderingPinnedMessage)
    || (shouldRenderAudioPlayer && renderingAudioMessage);

  // Logic for transition to and from custom display of AudioPlayer/PinnedMessage on smaller screens
  useLayoutEffect(() => {
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
        requestMutation(() => {
          componentEl.classList.remove('animated');
        });
      }, ANIMATION_DURATION);
    } else {
      componentEl.classList.remove('tools-stacked');
      shouldAnimateTools.current = true;
    }
  }, [shouldUseStackedToolsClass, canRevealTools, canToolsCollideWithChatInfo, isRightColumnShown]);

  const { connectionStatusText } = useConnectionStatus(lang, connectionState, isSyncing || isFetchingDifference, true);

  function renderInfo() {
    if (messageListType === 'thread') {
      if (threadId === MAIN_THREAD_ID || chat?.isForum) {
        return renderChatInfo();
      }
    }

    return (
      <>
        {renderBackButton()}
        <h3>
          {messagesCount !== undefined ? (
            messageListType === 'thread' ? (
              lang(isComments ? 'CommentsCount' : 'Replies', messagesCount, 'i'))
              : messageListType === 'pinned' ? (lang('PinnedMessagesCount', messagesCount, 'i'))
                : messageListType === 'scheduled' ? (
                  isChatWithSelf ? lang('Reminders') : lang('messages', messagesCount, 'i')
                ) : undefined
          ) : lang('Loading')}
        </h3>
      </>
    );
  }

  function renderChatInfo() {
    return (
      <>
        {(isLeftColumnHideable || currentTransitionKey > 0) && renderBackButton(shouldShowCloseButton, true)}
        <div
          className="chat-info-wrapper"
          onClick={handleHeaderClick}
          onMouseDown={handleHeaderMouseDown}
        >
          {isUserId(chatId) ? (
            <PrivateChatInfo
              key={chatId}
              userId={chatId}
              typingStatus={typingStatus}
              status={connectionStatusText}
              withDots={Boolean(connectionStatusText)}
              withFullInfo
              withMediaViewer
              withStory={!isChatWithSelf}
              withUpdatingStatus
              emojiStatusSize={EMOJI_STATUS_SIZE}
              noRtl
            />
          ) : (
            <GroupChatInfo
              key={chatId}
              chatId={chatId}
              threadId={threadId}
              typingStatus={typingStatus}
              status={connectionStatusText}
              withDots={Boolean(connectionStatusText)}
              withMediaViewer={threadId === MAIN_THREAD_ID}
              withFullInfo={threadId === MAIN_THREAD_ID}
              withUpdatingStatus
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
    || (!isMobile && hasButtonInHeader && windowWidth < MAX_SCREEN_WIDTH_FOR_EXPAND_PINNED_MESSAGES);

  useElectronDrag(componentRef);

  return (
    <div className="MiddleHeader" ref={componentRef}>
      <Transition
        name={shouldSkipHistoryAnimations ? 'none' : 'slideFade'}
        activeKey={currentTransitionKey}
        shouldCleanup
        cleanupExceptionKey={cleanupExceptionKey}
      >
        {renderInfo()}
      </Transition>

      {threadId === MAIN_THREAD_ID && !chat?.isForum && (
        <GroupCallTopPane
          hasPinnedOffset={
            (shouldRenderPinnedMessage && Boolean(renderingPinnedMessage))
            || (shouldRenderAudioPlayer && Boolean(renderingAudioMessage))
          }
          chatId={chatId}
        />
      )}

      {shouldRenderPinnedMessage && renderingPinnedMessage && (
        <HeaderPinnedMessage
          key={chatId}
          message={renderingPinnedMessage}
          count={renderingPinnedMessagesCount || 0}
          index={currentPinnedIndex}
          customTitle={renderingPinnedMessageTitle}
          className={pinnedMessageClassNames}
          onUnpinMessage={renderingCanUnpin ? handleUnpinMessage : undefined}
          onClick={handlePinnedMessageClick}
          onAllPinnedClick={handleAllPinnedClick}
          isLoading={waitingForPinnedId !== undefined}
          isFullWidth={isPinnedMessagesFullWidth}
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
          isMobile={isMobile}
          canExpandActions={!isAudioPlayerRendered}
        />
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, {
    chatId, threadId, messageListType, isMobile,
  }): StateProps => {
    const {
      isLeftColumnShown, shouldSkipHistoryAnimations, audioPlayer, messageLists,
    } = selectTabState(global);
    const chat = selectChat(global, chatId);

    const { chatId: audioChatId, messageId: audioMessageId } = audioPlayer;
    const audioMessage = audioChatId && audioMessageId
      ? selectChatMessage(global, audioChatId, audioMessageId)
      : undefined;

    let messagesCount: number | undefined;
    if (messageListType === 'pinned') {
      const pinnedIds = selectPinnedIds(global, chatId, threadId);
      messagesCount = pinnedIds?.length;
    } else if (messageListType === 'scheduled') {
      const scheduledIds = selectScheduledIds(global, chatId, threadId);
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
      chat && (isMainThread || chat.isForum) && (isChatChannel(chat) || isChatSuperGroup(chat)) && chat.isNotJoined,
    );
    const shouldSendJoinRequest = Boolean(chat?.isNotJoined && chat.isJoinRequest);
    const typingStatus = selectThreadParam(global, chatId, threadId, 'typingStatus');

    const state: StateProps = {
      typingStatus,
      isLeftColumnShown,
      isRightColumnShown: selectIsRightColumnShown(global, isMobile),
      isSelectModeActive: selectIsInSelectMode(global),
      audioMessage,
      chat,
      messagesCount,
      isChatWithSelf: selectIsChatWithSelf(global, chatId),
      shouldSkipHistoryAnimations,
      currentTransitionKey: Math.max(0, messageLists.length - 1),
      connectionState: global.connectionState,
      isSyncing: global.isSyncing,
      isSynced: global.isSynced,
      isFetchingDifference: global.isFetchingDifference,
      hasButtonInHeader: canStartBot || canRestartBot || canSubscribe || shouldSendJoinRequest,
    };

    const messagesById = selectChatMessages(global, chatId);
    if (messageListType !== 'thread' || !messagesById) {
      return state;
    }

    if (threadId !== MAIN_THREAD_ID && !chat?.isForum) {
      const pinnedMessageId = selectThreadTopMessageId(global, chatId, threadId);
      const message = pinnedMessageId ? selectChatMessage(global, chatId, pinnedMessageId) : undefined;
      const topMessageSender = message ? selectForwardedSender(global, message) : undefined;
      const threadInfo = selectThreadInfo(global, chatId, threadId);

      return {
        ...state,
        pinnedMessageIds: pinnedMessageId,
        messagesById,
        canUnpin: false,
        topMessageSender,
        isComments: Boolean(threadInfo?.originChannelId),
      };
    }

    const pinnedMessageIds = selectPinnedIds(global, chatId, threadId);
    if (pinnedMessageIds?.length) {
      const firstPinnedMessage = messagesById[pinnedMessageIds[0]];
      const {
        canUnpin,
      } = (firstPinnedMessage && selectAllowedMessageActions(global, firstPinnedMessage, threadId)) || {};

      return {
        ...state,
        pinnedMessageIds,
        messagesById,
        canUnpin,
      };
    }

    return state;
  },
)(MiddleHeader));
