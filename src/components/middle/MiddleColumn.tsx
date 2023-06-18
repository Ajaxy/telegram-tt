import type { RefObject } from 'react';
import React, {
  useEffect, useState, memo, useMemo,
} from '../../lib/teact/teact';
import { requestMutation } from '../../lib/fasterdom/fasterdom';
import { getActions, withGlobal } from '../../global';

import type { ApiChat, ApiChatBannedRights } from '../../api/types';
import { MAIN_THREAD_ID } from '../../api/types';
import type {
  MessageListType,
  ActiveEmojiInteraction,
} from '../../global/types';
import type { ThemeKey } from '../../types';

import {
  MOBILE_SCREEN_MAX_WIDTH,
  MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN,
  SAFE_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN,
  ANIMATION_END_DELAY,
  DARK_THEME_BG_COLOR,
  LIGHT_THEME_BG_COLOR,
  SUPPORTED_IMAGE_CONTENT_TYPES,
  GENERAL_TOPIC_ID,
  TMP_CHAT_ID,
  MAX_SCREEN_WIDTH_FOR_EXPAND_PINNED_MESSAGES,
} from '../../config';
import {
  IS_ANDROID, IS_IOS, IS_TRANSLATION_SUPPORTED, MASK_IMAGE_DISABLED,
} from '../../util/windowEnvironment';
import { DropAreaState } from './composer/DropArea';
import {
  selectCanAnimateInterface,
  selectChat,
  selectBot,
  selectChatFullInfo,
  selectChatMessage,
  selectCurrentMessageList,
  selectCurrentTextSearch,
  selectIsChatBotNotStarted,
  selectIsInSelectMode,
  selectIsRightColumnShown,
  selectIsUserBlocked,
  selectPinnedIds,
  selectReplyingToId,
  selectTabState,
  selectTheme,
  selectThreadInfo, selectThreadTopMessageId,
} from '../../global/selectors';
import {
  getCanPostInChat,
  getMessageSendingRestrictionReason,
  getForumComposerPlaceholder,
  isChatChannel,
  isChatGroup,
  isChatSuperGroup,
  isUserId,
} from '../../global/helpers';
import calculateMiddleFooterTransforms from './helpers/calculateMiddleFooterTransforms';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import buildClassName from '../../util/buildClassName';

import useLastCallback from '../../hooks/useLastCallback';
import useCustomBackground from '../../hooks/useCustomBackground';
import useWindowSize from '../../hooks/useWindowSize';
import usePrevDuringAnimation from '../../hooks/usePrevDuringAnimation';
import useLang from '../../hooks/useLang';
import useHistoryBack from '../../hooks/useHistoryBack';
import usePrevious from '../../hooks/usePrevious';
import useForceUpdate from '../../hooks/useForceUpdate';
import useSyncEffect from '../../hooks/useSyncEffect';
import useAppLayout from '../../hooks/useAppLayout';
import usePinnedMessage from './hooks/usePinnedMessage';
import { useResize } from '../../hooks/useResize';

import Transition from '../ui/Transition';
import MiddleHeader from './MiddleHeader';
import MessageList from './MessageList';
import FloatingActionButtons from './FloatingActionButtons';
import Composer from './composer/Composer';
import Button from '../ui/Button';
import MobileSearch from './MobileSearch.async';
import MessageSelectToolbar from './MessageSelectToolbar.async';
import UnpinAllMessagesModal from '../common/UnpinAllMessagesModal.async';
import SeenByModal from '../common/SeenByModal.async';
import EmojiInteractionAnimation from './EmojiInteractionAnimation.async';
import ReactorListModal from './ReactorListModal.async';
import GiftPremiumModal from '../main/premium/GiftPremiumModal.async';
import MessageLanguageModal from './MessageLanguageModal.async';

import './MiddleColumn.scss';

import styles from './MiddleColumn.module.scss';

interface OwnProps {
  leftColumnRef: RefObject<HTMLDivElement>;
  isMobile?: boolean;
}

type StateProps = {
  chatId?: string;
  threadId?: number;
  messageListType?: MessageListType;
  chat?: ApiChat;
  replyingToId?: number;
  isPrivate?: boolean;
  isPinnedMessageList?: boolean;
  canPost?: boolean;
  currentUserBannedRights?: ApiChatBannedRights;
  defaultBannedRights?: ApiChatBannedRights;
  hasPinned?: boolean;
  hasAudioPlayer?: boolean;
  hasButtonInHeader?: boolean;
  pinnedMessagesCount?: number;
  theme: ThemeKey;
  customBackground?: string;
  backgroundColor?: string;
  patternColor?: string;
  isLeftColumnShown?: boolean;
  isRightColumnShown?: boolean;
  isBackgroundBlurred?: boolean;
  leftColumnWidth?: number;
  hasCurrentTextSearch?: boolean;
  isSelectModeActive?: boolean;
  isSeenByModalOpen: boolean;
  isReactorListModalOpen: boolean;
  isGiftPremiumModalOpen?: boolean;
  isMessageLanguageModalOpen?: boolean;
  withInterfaceAnimations?: boolean;
  shouldSkipHistoryAnimations?: boolean;
  currentTransitionKey: number;
  isChannel?: boolean;
  areChatSettingsLoaded?: boolean;
  canSubscribe?: boolean;
  canStartBot?: boolean;
  canRestartBot?: boolean;
  shouldLoadFullChat?: boolean;
  activeEmojiInteractions?: ActiveEmojiInteraction[];
  shouldJoinToSend?: boolean;
  shouldSendJoinRequest?: boolean;
  lastSyncTime?: number;
  pinnedIds?: number[];
  topMessageId?: number;
};

function isImage(item: DataTransferItem) {
  return item.kind === 'file' && item.type && SUPPORTED_IMAGE_CONTENT_TYPES.has(item.type);
}

const LAYER_ANIMATION_DURATION_MS = 450 + ANIMATION_END_DELAY;

function MiddleColumn({
  leftColumnRef,
  chatId,
  threadId,
  messageListType,
  isMobile,
  chat,
  replyingToId,
  isPrivate,
  isPinnedMessageList,
  canPost,
  currentUserBannedRights,
  defaultBannedRights,
  hasPinned,
  hasAudioPlayer,
  hasButtonInHeader,
  pinnedMessagesCount,
  customBackground,
  theme,
  backgroundColor,
  patternColor,
  isLeftColumnShown,
  isRightColumnShown,
  isBackgroundBlurred,
  leftColumnWidth,
  hasCurrentTextSearch,
  isSelectModeActive,
  isSeenByModalOpen,
  isReactorListModalOpen,
  isGiftPremiumModalOpen,
  isMessageLanguageModalOpen,
  withInterfaceAnimations,
  shouldSkipHistoryAnimations,
  currentTransitionKey,
  isChannel,
  areChatSettingsLoaded,
  canSubscribe,
  canStartBot,
  canRestartBot,
  activeEmojiInteractions,
  shouldJoinToSend,
  shouldSendJoinRequest,
  shouldLoadFullChat,
  lastSyncTime,
  pinnedIds,
  topMessageId,
}: OwnProps & StateProps) {
  const {
    openChat,
    openPreviousChat,
    unpinAllMessages,
    loadUser,
    loadChatSettings,
    closeLocalTextSearch,
    exitMessageSelectMode,
    joinChannel,
    sendBotCommand,
    restartBot,
    showNotification,
    loadFullChat,
    setLeftColumnWidth,
    resetLeftColumnWidth,
  } = getActions();

  const { width: windowWidth } = useWindowSize();
  const { isTablet, isDesktop } = useAppLayout();

  const lang = useLang();
  const [dropAreaState, setDropAreaState] = useState(DropAreaState.None);
  const [isFabShown, setIsFabShown] = useState<boolean | undefined>();
  const [isNotchShown, setIsNotchShown] = useState<boolean | undefined>();
  const [isUnpinModalOpen, setIsUnpinModalOpen] = useState(false);

  const {
    onIntersectionChanged,
    onFocusPinnedMessage,
    getCurrentPinnedIndexes,
    getLoadingPinnedId,
    getForceNextPinnedInHeader,
  } = usePinnedMessage(chatId, threadId, pinnedIds, topMessageId);

  const isMobileSearchActive = isMobile && hasCurrentTextSearch;
  const closeAnimationDuration = isMobile ? LAYER_ANIMATION_DURATION_MS : undefined;
  const hasTools = hasPinned && (
    windowWidth < MOBILE_SCREEN_MAX_WIDTH
    || hasAudioPlayer
    || (
      isRightColumnShown && windowWidth > MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN
      && windowWidth < SAFE_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN
    )
    || (!isMobile && hasButtonInHeader && windowWidth < MAX_SCREEN_WIDTH_FOR_EXPAND_PINNED_MESSAGES)
  );

  const renderingChatId = usePrevDuringAnimation(chatId, closeAnimationDuration);
  const renderingThreadId = usePrevDuringAnimation(threadId, closeAnimationDuration);
  const renderingMessageListType = usePrevDuringAnimation(messageListType, closeAnimationDuration);
  const renderingCanSubscribe = usePrevDuringAnimation(canSubscribe, closeAnimationDuration);
  const renderingCanStartBot = usePrevDuringAnimation(canStartBot, closeAnimationDuration);
  const renderingCanRestartBot = usePrevDuringAnimation(canRestartBot, closeAnimationDuration);
  const renderingCanPost = usePrevDuringAnimation(canPost, closeAnimationDuration)
    && !renderingCanRestartBot && !renderingCanStartBot && !renderingCanSubscribe && chatId !== TMP_CHAT_ID;
  const renderingHasTools = usePrevDuringAnimation(hasTools, closeAnimationDuration);
  const renderingIsFabShown = usePrevDuringAnimation(isFabShown, closeAnimationDuration) && chatId !== TMP_CHAT_ID;
  const renderingIsChannel = usePrevDuringAnimation(isChannel, closeAnimationDuration);
  const renderingShouldJoinToSend = usePrevDuringAnimation(shouldJoinToSend, closeAnimationDuration);
  const renderingShouldSendJoinRequest = usePrevDuringAnimation(shouldSendJoinRequest, closeAnimationDuration);
  const renderingOnPinnedIntersectionChange = usePrevDuringAnimation(
    chatId ? onIntersectionChanged : undefined,
    closeAnimationDuration,
  );

  const prevTransitionKey = usePrevious(currentTransitionKey);

  const cleanupExceptionKey = (
    prevTransitionKey !== undefined && prevTransitionKey < currentTransitionKey ? prevTransitionKey : undefined
  );

  const { isReady, handleCssTransitionEnd, handleSlideTransitionStop } = useIsReady(
    !shouldSkipHistoryAnimations && withInterfaceAnimations,
    currentTransitionKey,
    prevTransitionKey,
    chatId,
    isMobile,
  );

  useEffect(() => {
    return chatId
      ? captureEscKeyListener(() => {
        openChat({ id: undefined });
      })
      : undefined;
  }, [chatId, openChat]);

  useSyncEffect(() => {
    setDropAreaState(DropAreaState.None);
    setIsNotchShown(undefined);
  }, [chatId]);

  // Fix for mobile virtual keyboard
  useEffect(() => {
    if (!IS_IOS && !IS_ANDROID) {
      return undefined;
    }

    const { visualViewport } = window;
    if (!visualViewport) {
      return undefined;
    }

    const handleResize = () => {
      const isFixNeeded = visualViewport.height !== document.documentElement.clientHeight;

      requestMutation(() => {
        document.body.classList.toggle('keyboard-visible', isFixNeeded);
      });
    };

    visualViewport.addEventListener('resize', handleResize);

    return () => {
      visualViewport.removeEventListener('resize', handleResize);
    };
  });

  useEffect(() => {
    if (isPrivate) {
      loadUser({ userId: chatId! });
    }
  }, [chatId, isPrivate, loadUser]);

  useEffect(() => {
    if (!areChatSettingsLoaded && lastSyncTime) {
      loadChatSettings({ chatId: chatId! });
    }
  }, [chatId, isPrivate, areChatSettingsLoaded, lastSyncTime, loadChatSettings]);

  useEffect(() => {
    if (chatId && shouldLoadFullChat && isReady) {
      loadFullChat({ chatId });
    }
  }, [shouldLoadFullChat, chatId, isReady, loadFullChat]);

  const {
    initResize, resetResize, handleMouseUp,
  } = useResize(leftColumnRef, (n) => setLeftColumnWidth({
    leftColumnWidth: n,
  }), resetLeftColumnWidth, leftColumnWidth, '--left-column-width');

  const handleDragEnter = useLastCallback((e: React.DragEvent<HTMLDivElement>) => {
    const { items } = e.dataTransfer || {};
    const shouldDrawQuick = items && items.length > 0 && Array.from(items)
      // Filter unnecessary element for drag and drop images in Firefox (https://github.com/Ajaxy/telegram-tt/issues/49)
      // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Recommended_drag_types#image
      .filter((item) => item.type !== 'text/uri-list')
      // As of September 2021, native clients suggest "send quick, but compressed" only for images
      .every(isImage);

    setDropAreaState(shouldDrawQuick ? DropAreaState.QuickFile : DropAreaState.Document);
  });

  const handleHideDropArea = useLastCallback(() => {
    setDropAreaState(DropAreaState.None);
  });

  const handleOpenUnpinModal = useLastCallback(() => {
    setIsUnpinModalOpen(true);
  });

  const closeUnpinModal = useLastCallback(() => {
    setIsUnpinModalOpen(false);
  });

  const handleUnpinAllMessages = useLastCallback(() => {
    unpinAllMessages({ chatId: chatId!, threadId: threadId! });
    closeUnpinModal();
    openPreviousChat();
  });

  const handleTabletFocus = useLastCallback(() => {
    openChat({ id: chatId });
  });

  const handleSubscribeClick = useLastCallback(() => {
    joinChannel({ chatId: chatId! });
    if (renderingShouldSendJoinRequest) {
      showNotification({
        message: isChannel ? lang('RequestToJoinChannelSentDescription') : lang('RequestToJoinGroupSentDescription'),
      });
    }
  });

  const handleStartBot = useLastCallback(() => {
    sendBotCommand({ command: '/start' });
  });

  const handleRestartBot = useLastCallback(() => {
    restartBot({ chatId: chatId! });
  });

  const customBackgroundValue = useCustomBackground(theme, customBackground);

  const className = buildClassName(
    renderingHasTools && 'has-header-tools',
    MASK_IMAGE_DISABLED ? 'mask-image-disabled' : 'mask-image-enabled',
  );

  const bgClassName = buildClassName(
    styles.background,
    styles.withTransition,
    customBackground && styles.customBgImage,
    backgroundColor && styles.customBgColor,
    customBackground && isBackgroundBlurred && styles.blurred,
    isRightColumnShown && styles.withRightColumn,
  );

  const messagingDisabledClassName = buildClassName(
    'messaging-disabled',
    !isSelectModeActive && 'shown',
  );

  const messageSendingRestrictionReason = getMessageSendingRestrictionReason(
    lang, currentUserBannedRights, defaultBannedRights,
  );
  const forumComposerPlaceholder = getForumComposerPlaceholder(lang, chat, threadId, Boolean(replyingToId));

  const composerRestrictionMessage = messageSendingRestrictionReason || forumComposerPlaceholder;

  // CSS Variables calculation doesn't work properly with transforms, so we calculate transform values in JS
  const {
    composerHiddenScale, toolbarHiddenScale,
    composerTranslateX, toolbarTranslateX,
    unpinHiddenScale, toolbarForUnpinHiddenScale,
  } = useMemo(
    () => calculateMiddleFooterTransforms(windowWidth, renderingCanPost),
    [renderingCanPost, windowWidth],
  );

  const footerClassName = buildClassName(
    'middle-column-footer',
    !renderingCanPost && 'no-composer',
    renderingCanPost && isNotchShown && !isSelectModeActive && 'with-notch',
  );

  useHistoryBack({
    isActive: isSelectModeActive,
    onBack: exitMessageSelectMode,
  });

  useHistoryBack({
    isActive: isMobileSearchActive,
    onBack: closeLocalTextSearch,
  });

  const isMessagingDisabled = Boolean(
    !isPinnedMessageList && !renderingCanPost && !renderingCanRestartBot && !renderingCanStartBot
    && !renderingCanSubscribe && composerRestrictionMessage,
  );
  const withMessageListBottomShift = Boolean(
    renderingCanRestartBot || renderingCanSubscribe || renderingShouldSendJoinRequest || renderingCanStartBot
    || isPinnedMessageList,
  );
  const withExtraShift = Boolean(isMessagingDisabled || isSelectModeActive || isPinnedMessageList);

  return (
    <div
      id="MiddleColumn"
      className={className}
      onTransitionEnd={handleCssTransitionEnd}
      style={`
        --composer-hidden-scale: ${composerHiddenScale};
        --toolbar-hidden-scale: ${toolbarHiddenScale};
        --unpin-hidden-scale: ${unpinHiddenScale};
        --toolbar-unpin-hidden-scale: ${toolbarForUnpinHiddenScale};
        --composer-translate-x: ${composerTranslateX}px;
        --toolbar-translate-x: ${toolbarTranslateX}px;
        --pattern-color: ${patternColor};
        --theme-background-color:
          ${backgroundColor || (theme === 'dark' ? DARK_THEME_BG_COLOR : LIGHT_THEME_BG_COLOR)};
      `}
      onClick={(isTablet && isLeftColumnShown) ? handleTabletFocus : undefined}
    >
      {isDesktop && (
        <div
          className="resize-handle"
          onMouseDown={initResize}
          onMouseUp={handleMouseUp}
          onDoubleClick={resetResize}
        />
      )}
      <div
        className={bgClassName}
        style={customBackgroundValue ? `--custom-background: ${customBackgroundValue}` : undefined}
      />
      <div id="middle-column-portals" />
      {Boolean(renderingChatId && renderingThreadId) && (
        <>
          <div className="messages-layout" onDragEnter={renderingCanPost ? handleDragEnter : undefined}>
            <MiddleHeader
              chatId={renderingChatId!}
              threadId={renderingThreadId!}
              messageListType={renderingMessageListType!}
              isReady={isReady}
              isMobile={isMobile}
              getCurrentPinnedIndexes={getCurrentPinnedIndexes}
              getLoadingPinnedId={getLoadingPinnedId}
              onFocusPinnedMessage={onFocusPinnedMessage}
            />
            <Transition
              name={shouldSkipHistoryAnimations ? 'none' : withInterfaceAnimations ? 'slide' : 'fade'}
              activeKey={currentTransitionKey}
              shouldCleanup
              cleanupExceptionKey={cleanupExceptionKey}
              onStop={handleSlideTransitionStop}
            >
              <MessageList
                key={`${renderingChatId}-${renderingThreadId}-${renderingMessageListType}`}
                chatId={renderingChatId!}
                threadId={renderingThreadId!}
                type={renderingMessageListType!}
                canPost={renderingCanPost!}
                hasTools={renderingHasTools}
                onFabToggle={setIsFabShown}
                onNotchToggle={setIsNotchShown}
                isReady={isReady}
                withBottomShift={withMessageListBottomShift}
                withDefaultBg={Boolean(!customBackground && !backgroundColor)}
                onPinnedIntersectionChange={renderingOnPinnedIntersectionChange!}
                getForceNextPinnedInHeader={getForceNextPinnedInHeader}
              />
              <div className={footerClassName}>
                {renderingCanPost && (
                  <Composer
                    chatId={renderingChatId!}
                    threadId={renderingThreadId!}
                    messageListType={renderingMessageListType!}
                    dropAreaState={dropAreaState}
                    onDropHide={handleHideDropArea}
                    isReady={isReady}
                    isMobile={isMobile}
                  />
                )}
                {isPinnedMessageList && (
                  <div className="middle-column-footer-button-container" dir={lang.isRtl ? 'rtl' : undefined}>
                    <Button
                      size="tiny"
                      fluid
                      color="secondary"
                      className="unpin-all-button"
                      onClick={handleOpenUnpinModal}
                    >
                      <i className="icon icon-unpin" />
                      <span>{lang('Chat.Pinned.UnpinAll', pinnedMessagesCount, 'i')}</span>
                    </Button>
                  </div>
                )}
                {isMessagingDisabled && (
                  <div className={messagingDisabledClassName}>
                    <div className="messaging-disabled-inner">
                      <span>
                        {composerRestrictionMessage}
                      </span>
                    </div>
                  </div>
                )}
                {(
                  isMobile && (renderingCanSubscribe || (renderingShouldJoinToSend && !renderingShouldSendJoinRequest))
                ) && (
                  <div className="middle-column-footer-button-container" dir={lang.isRtl ? 'rtl' : undefined}>
                    <Button
                      size="tiny"
                      fluid
                      ripple
                      className="join-subscribe-button"
                      onClick={handleSubscribeClick}
                    >
                      {lang(renderingIsChannel ? 'ProfileJoinChannel' : 'ProfileJoinGroup')}
                    </Button>
                  </div>
                )}
                {isMobile && renderingShouldSendJoinRequest && (
                  <div className="middle-column-footer-button-container" dir={lang.isRtl ? 'rtl' : undefined}>
                    <Button
                      size="tiny"
                      fluid
                      ripple
                      className="join-subscribe-button"
                      onClick={handleSubscribeClick}
                    >
                      {lang('ChannelJoinRequest')}
                    </Button>
                  </div>
                )}
                {isMobile && renderingCanStartBot && (
                  <div className="middle-column-footer-button-container" dir={lang.isRtl ? 'rtl' : undefined}>
                    <Button
                      size="tiny"
                      fluid
                      ripple
                      className="join-subscribe-button"
                      onClick={handleStartBot}
                    >
                      {lang('BotStart')}
                    </Button>
                  </div>
                )}
                {isMobile && renderingCanRestartBot && (
                  <div className="middle-column-footer-button-container" dir={lang.isRtl ? 'rtl' : undefined}>
                    <Button
                      size="tiny"
                      fluid
                      ripple
                      className="join-subscribe-button"
                      onClick={handleRestartBot}
                    >
                      {lang('BotRestart')}
                    </Button>
                  </div>
                )}
                <MessageSelectToolbar
                  messageListType={renderingMessageListType}
                  isActive={isSelectModeActive}
                  canPost={renderingCanPost}
                />
                <SeenByModal isOpen={isSeenByModalOpen} />
                <ReactorListModal isOpen={isReactorListModalOpen} />
                {IS_TRANSLATION_SUPPORTED && <MessageLanguageModal isOpen={isMessageLanguageModalOpen} />}
              </div>
            </Transition>

            <FloatingActionButtons
              isShown={renderingIsFabShown!}
              canPost={renderingCanPost}
              withExtraShift={withExtraShift}
            />
          </div>
          {isMobile && <MobileSearch isActive={Boolean(isMobileSearchActive)} />}
        </>
      )}
      {chatId && (
        <UnpinAllMessagesModal
          isOpen={isUnpinModalOpen}
          chatId={chatId}
          pinnedMessagesCount={pinnedMessagesCount}
          onClose={closeUnpinModal}
          onUnpin={handleUnpinAllMessages}
        />
      )}
      <div teactFastList>
        {activeEmojiInteractions?.map((activeEmojiInteraction, i) => (
          <EmojiInteractionAnimation
            teactOrderKey={i}
            key={activeEmojiInteraction.id}
            activeEmojiInteraction={activeEmojiInteraction}
          />
        ))}
      </div>
      <GiftPremiumModal isOpen={isGiftPremiumModalOpen} />
    </div>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { isMobile }): StateProps => {
    const theme = selectTheme(global);
    const {
      isBlurred: isBackgroundBlurred, background: customBackground, backgroundColor, patternColor,
    } = global.settings.themes[theme] || {};

    const {
      messageLists, isLeftColumnShown, activeEmojiInteractions,
      seenByModal, giftPremiumModal, reactorModal, audioPlayer, shouldSkipHistoryAnimations,
      messageLanguageModal,
    } = selectTabState(global);
    const currentMessageList = selectCurrentMessageList(global);
    const { leftColumnWidth, lastSyncTime } = global;

    const state: StateProps = {
      theme,
      customBackground,
      backgroundColor,
      patternColor,
      isLeftColumnShown,
      isRightColumnShown: selectIsRightColumnShown(global, isMobile),
      isBackgroundBlurred,
      hasCurrentTextSearch: Boolean(selectCurrentTextSearch(global)),
      isSelectModeActive: selectIsInSelectMode(global),
      isSeenByModalOpen: Boolean(seenByModal),
      isReactorListModalOpen: Boolean(reactorModal),
      isGiftPremiumModalOpen: giftPremiumModal?.isOpen,
      isMessageLanguageModalOpen: Boolean(messageLanguageModal),
      withInterfaceAnimations: selectCanAnimateInterface(global),
      currentTransitionKey: Math.max(0, messageLists.length - 1),
      activeEmojiInteractions,
      leftColumnWidth,
      lastSyncTime,
    };

    if (!currentMessageList) {
      return state;
    }

    const { chatId, threadId, type: messageListType } = currentMessageList;
    const isPrivate = isUserId(chatId);
    const chat = selectChat(global, chatId);
    const bot = selectBot(global, chatId);
    const pinnedIds = selectPinnedIds(global, chatId, threadId);
    const { chatId: audioChatId, messageId: audioMessageId } = audioPlayer;

    const threadInfo = selectThreadInfo(global, chatId, threadId);
    const isComments = Boolean(threadInfo?.originChannelId);
    const canPost = chat && getCanPostInChat(chat, threadId, isComments);
    const isBotNotStarted = selectIsChatBotNotStarted(global, chatId);
    const isPinnedMessageList = messageListType === 'pinned';
    const isMainThread = messageListType === 'thread' && threadId === MAIN_THREAD_ID;
    const isChannel = Boolean(chat && isChatChannel(chat));
    const canSubscribe = Boolean(
      chat && isMainThread && (isChannel || isChatSuperGroup(chat)) && chat.isNotJoined && !chat.joinRequests,
    );
    const shouldJoinToSend = Boolean(chat?.isNotJoined && chat.isJoinToSend);
    const shouldSendJoinRequest = Boolean(chat?.isNotJoined && chat.isJoinRequest);
    const canRestartBot = Boolean(bot && selectIsUserBlocked(global, bot.id));
    const canStartBot = !canRestartBot && isBotNotStarted;
    const shouldLoadFullChat = Boolean(
      chat && isChatGroup(chat) && !selectChatFullInfo(global, chat.id) && lastSyncTime,
    );
    const replyingToId = selectReplyingToId(global, chatId, threadId);
    const shouldBlockSendInForum = chat?.isForum
      ? threadId === MAIN_THREAD_ID && !replyingToId && (chat.topics?.[GENERAL_TOPIC_ID]?.isClosed)
      : false;
    const audioMessage = audioChatId && audioMessageId
      ? selectChatMessage(global, audioChatId, audioMessageId)
      : undefined;

    const isCommentThread = threadId !== MAIN_THREAD_ID && !chat?.isForum;
    const topMessageId = isCommentThread ? selectThreadTopMessageId(global, chatId, threadId) : undefined;

    return {
      ...state,
      chatId,
      threadId,
      messageListType,
      chat,
      replyingToId,
      isPrivate,
      areChatSettingsLoaded: Boolean(chat?.settings),
      canPost: !isPinnedMessageList
        && (!chat || canPost)
        && !isBotNotStarted
        && !(shouldJoinToSend && chat?.isNotJoined)
        && !shouldBlockSendInForum,
      isPinnedMessageList,
      currentUserBannedRights: chat?.currentUserBannedRights,
      defaultBannedRights: chat?.defaultBannedRights,
      hasPinned: isCommentThread || Boolean(!isPinnedMessageList && pinnedIds?.length),
      hasAudioPlayer: Boolean(audioMessage),
      hasButtonInHeader: canStartBot || canRestartBot || canSubscribe || shouldSendJoinRequest,
      pinnedMessagesCount: pinnedIds ? pinnedIds.length : 0,
      shouldSkipHistoryAnimations,
      isChannel,
      canSubscribe,
      canStartBot,
      canRestartBot,
      shouldJoinToSend,
      shouldSendJoinRequest,
      shouldLoadFullChat,
      pinnedIds,
      topMessageId,
    };
  },
)(MiddleColumn));

function useIsReady(
  withAnimations?: boolean,
  currentTransitionKey?: number,
  prevTransitionKey?: number,
  chatId?: string,
  isMobile?: boolean,
) {
  const [isReady, setIsReady] = useState(!isMobile);
  const forceUpdate = useForceUpdate();

  const willSwitchMessageList = prevTransitionKey !== undefined && prevTransitionKey !== currentTransitionKey;
  if (willSwitchMessageList) {
    if (withAnimations) {
      setIsReady(false);

      // Make sure to end even if end callback was not called (which was some hardly-reproducible bug)
      setTimeout(() => {
        setIsReady(true);
      }, LAYER_ANIMATION_DURATION_MS);
    } else {
      forceUpdate();
    }
  }

  useSyncEffect(() => {
    if (!withAnimations) {
      setIsReady(true);
    }
  }, [withAnimations]);

  function handleCssTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
    if (e.propertyName === 'transform' && e.target === e.currentTarget) {
      setIsReady(Boolean(chatId));
    }
  }

  function handleSlideTransitionStop() {
    setIsReady(true);
  }

  return {
    isReady: isReady && !willSwitchMessageList,
    handleCssTransitionEnd: withAnimations ? handleCssTransitionEnd : undefined,
    handleSlideTransitionStop: withAnimations ? handleSlideTransitionStop : undefined,
  };
}
