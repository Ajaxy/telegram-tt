import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiChat, ApiMessage, ApiSticker, ApiTypingStatus,
} from '../../api/types';
import type { GlobalState } from '../../global/types';
import type { Signal } from '../../util/signals';
import { MAIN_THREAD_ID } from '../../api/types';
import { type MessageListType, StoryViewerOrigin, type ThreadId } from '../../types';

import {
  EDITABLE_INPUT_CSS_SELECTOR,
  MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN,
} from '../../config';
import {
  getIsSavedDialog,
  isUserId,
} from '../../global/helpers';
import {
  selectChat,
  selectChatMessage,
  selectIsChatWithSelf,
  selectIsInSelectMode,
  selectIsRightColumnShown,
  selectPinnedIds,
  selectScheduledIds,
  selectTabState,
  selectThreadInfo,
  selectThreadParam,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useAppLayout from '../../hooks/useAppLayout';
import useConnectionStatus from '../../hooks/useConnectionStatus';
import useElectronDrag from '../../hooks/useElectronDrag';
import useLastCallback from '../../hooks/useLastCallback';
import useLongPress from '../../hooks/useLongPress';
import useOldLang from '../../hooks/useOldLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';
import useWindowSize from '../../hooks/window/useWindowSize';

import GroupChatInfo from '../common/GroupChatInfo';
import PrivateChatInfo from '../common/PrivateChatInfo';
import UnreadCounter from '../common/UnreadCounter';
import Button from '../ui/Button';
import Transition from '../ui/Transition';
import HeaderActions from './HeaderActions';
import AudioPlayer from './panes/AudioPlayer';
import HeaderPinnedMessage from './panes/HeaderPinnedMessage';

import './MiddleHeader.scss';

const BACK_BUTTON_INACTIVE_TIME = 450;
const EMOJI_STATUS_SIZE = 22;
const SEARCH_LONGTAP_THRESHOLD = 500;

type OwnProps = {
  chatId: string;
  threadId: ThreadId;
  messageListType: MessageListType;
  isComments?: boolean;
  isMobile?: boolean;
  getCurrentPinnedIndex: Signal<number>;
  getLoadingPinnedId: Signal<number | undefined>;
  onFocusPinnedMessage: (messageId: number) => void;
};

type StateProps = {
  chat?: ApiChat;
  isSavedDialog?: boolean;
  typingStatus?: ApiTypingStatus;
  isSelectModeActive?: boolean;
  isLeftColumnShown?: boolean;
  isRightColumnShown?: boolean;
  audioMessage?: ApiMessage;
  messagesCount?: number;
  isChatWithSelf?: boolean;
  shouldSkipHistoryAnimations?: boolean;
  currentTransitionKey: number;
  connectionState?: GlobalState['connectionState'];
  isSyncing?: boolean;
  isFetchingDifference?: boolean;
  emojiStatusSticker?: ApiSticker;
  emojiStatusSlug?: string;
};

const MiddleHeader: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  messageListType,
  isMobile,
  typingStatus,
  isSelectModeActive,
  isLeftColumnShown,
  audioMessage,
  chat,
  messagesCount,
  isComments,
  isChatWithSelf,
  shouldSkipHistoryAnimations,
  currentTransitionKey,
  connectionState,
  isSyncing,
  isFetchingDifference,
  getCurrentPinnedIndex,
  getLoadingPinnedId,
  emojiStatusSticker,
  emojiStatusSlug,
  isSavedDialog,
  onFocusPinnedMessage,
}) => {
  const {
    openThreadWithInfo,
    openChat,
    openPreviousChat,
    toggleLeftColumn,
    exitMessageSelectMode,
    openPremiumModal,
    openStickerSet,
    updateMiddleSearch,
    openUniqueGiftBySlug,
  } = getActions();

  const lang = useOldLang();
  const isBackButtonActive = useRef(true);
  const { isTablet } = useAppLayout();

  const { width: windowWidth } = useWindowSize();

  const { isDesktop } = useAppLayout();

  const isLeftColumnHideable = windowWidth <= MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN;
  const shouldShowCloseButton = isTablet && isLeftColumnShown;

  // eslint-disable-next-line no-null/no-null
  const componentRef = useRef<HTMLDivElement>(null);

  const handleOpenSearch = useLastCallback(() => {
    updateMiddleSearch({ chatId, threadId, update: {} });
  });

  const handleOpenChat = useLastCallback((event: React.MouseEvent | React.TouchEvent) => {
    if ((event.target as Element).closest('.title > .custom-emoji')) return;

    openThreadWithInfo({ chatId, threadId });
  });

  const {
    onMouseDown: handleLongPressMouseDown,
    onMouseUp: handleLongPressMouseUp,
    onMouseLeave: handleLongPressMouseLeave,
    onTouchStart: handleLongPressTouchStart,
    onTouchEnd: handleLongPressTouchEnd,
  } = useLongPress({
    onStart: handleOpenSearch,
    onClick: handleOpenChat,
    threshold: SEARCH_LONGTAP_THRESHOLD,
  });

  const setBackButtonActive = useLastCallback(() => {
    setTimeout(() => {
      isBackButtonActive.current = true;
    }, BACK_BUTTON_INACTIVE_TIME);
  });

  const handleUserStatusClick = useLastCallback(() => {
    if (emojiStatusSlug) {
      openUniqueGiftBySlug({ slug: emojiStatusSlug });
      return;
    }
    openPremiumModal({ fromUserId: chatId });
  });

  const handleChannelStatusClick = useLastCallback(() => {
    if (emojiStatusSlug) {
      openUniqueGiftBySlug({ slug: emojiStatusSlug });
      return;
    }
    openStickerSet({
      stickerSetInfo: emojiStatusSticker!.stickerSetInfo,
    });
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

  const prevTransitionKey = usePreviousDeprecated(currentTransitionKey);
  const cleanupExceptionKey = (
    prevTransitionKey !== undefined && prevTransitionKey < currentTransitionKey ? prevTransitionKey : undefined
  );

  const isAudioPlayerActive = Boolean(audioMessage);
  const isAudioPlayerRendering = isDesktop && isAudioPlayerActive;
  const isPinnedMessagesFullWidth = isAudioPlayerActive || !isDesktop;

  const { connectionStatusText } = useConnectionStatus(lang, connectionState, isSyncing || isFetchingDifference, true);

  function renderInfo() {
    if (messageListType === 'thread') {
      if (threadId === MAIN_THREAD_ID || isSavedDialog || chat?.isForum) {
        return renderChatInfo();
      }
    }

    return (
      <>
        {renderBackButton()}
        <h3>
          {messagesCount !== undefined ? (
            messageListType === 'thread' ? (
              (messagesCount
                ? lang(isComments ? 'Comments' : 'Replies', messagesCount, 'i')
                : lang(isComments ? 'CommentsTitle' : 'RepliesTitle')))
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
    // TODO Implement count
    const savedMessagesStatus = isSavedDialog ? lang('SavedMessages') : undefined;

    const realChatId = isSavedDialog ? String(threadId) : chatId;
    return (
      <>
        {(isLeftColumnHideable || currentTransitionKey > 0) && renderBackButton(shouldShowCloseButton, !isSavedDialog)}
        <div
          className="chat-info-wrapper"
          onMouseDown={handleLongPressMouseDown}
          onMouseUp={handleLongPressMouseUp}
          onMouseLeave={handleLongPressMouseLeave}
          onTouchStart={handleLongPressTouchStart}
          onTouchEnd={handleLongPressTouchEnd}
        >
          {isUserId(realChatId) ? (
            <PrivateChatInfo
              key={realChatId}
              userId={realChatId}
              typingStatus={typingStatus}
              status={connectionStatusText || savedMessagesStatus}
              withDots={Boolean(connectionStatusText)}
              withFullInfo
              withMediaViewer
              withStory={!isChatWithSelf}
              withUpdatingStatus
              isSavedDialog={isSavedDialog}
              storyViewerOrigin={StoryViewerOrigin.MiddleHeaderAvatar}
              emojiStatusSize={EMOJI_STATUS_SIZE}
              noRtl
              onEmojiStatusClick={handleUserStatusClick}
            />
          ) : (
            <GroupChatInfo
              key={realChatId}
              chatId={realChatId}
              threadId={!isSavedDialog ? threadId : undefined}
              typingStatus={typingStatus}
              status={connectionStatusText || savedMessagesStatus}
              withDots={Boolean(connectionStatusText)}
              withMediaViewer={threadId === MAIN_THREAD_ID}
              withFullInfo={threadId === MAIN_THREAD_ID}
              withUpdatingStatus
              withStory
              isSavedDialog={isSavedDialog}
              storyViewerOrigin={StoryViewerOrigin.MiddleHeaderAvatar}
              emojiStatusSize={EMOJI_STATUS_SIZE}
              onEmojiStatusClick={handleChannelStatusClick}
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
      {!isPinnedMessagesFullWidth && (
        <HeaderPinnedMessage
          key={chatId}
          chatId={chatId}
          threadId={threadId}
          messageListType={messageListType}
          onFocusPinnedMessage={onFocusPinnedMessage}
          getLoadingPinnedId={getLoadingPinnedId}
          getCurrentPinnedIndex={getCurrentPinnedIndex}
        />
      )}

      <div className="header-tools">
        {isAudioPlayerRendering && (
          <AudioPlayer />
        )}
        <HeaderActions
          chatId={chatId}
          threadId={threadId}
          messageListType={messageListType}
          isMobile={isMobile}
          canExpandActions={!isAudioPlayerRendering}
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

    const typingStatus = selectThreadParam(global, chatId, threadId, 'typingStatus');

    const emojiStatus = chat?.emojiStatus;
    const emojiStatusSticker = emojiStatus && global.customEmojis.byId[emojiStatus.documentId];
    const emojiStatusSlug = emojiStatus?.type === 'collectible' ? emojiStatus.slug : undefined;

    const isSavedDialog = getIsSavedDialog(chatId, threadId, global.currentUserId);

    return {
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
      isFetchingDifference: global.isFetchingDifference,
      emojiStatusSticker,
      emojiStatusSlug,
      isSavedDialog,
    };
  },
)(MiddleHeader));
