import React, {
  memo, useEffect, useMemo,
  useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiChat, ApiChatBannedRights, ApiInputMessageReplyInfo, ApiTopic,
} from '../../api/types';
import type {
  ActiveEmojiInteraction,
  MessageListType,
  ThemeKey,
  ThreadId,
} from '../../types';
import { MAIN_THREAD_ID } from '../../api/types';

import {
  ANIMATION_END_DELAY,
  ANONYMOUS_USER_ID,
  EDITABLE_INPUT_CSS_SELECTOR,
  EDITABLE_INPUT_ID,
  GENERAL_TOPIC_ID,
  SUPPORTED_PHOTO_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
  TMP_CHAT_ID,
} from '../../config';
import { requestMeasure, requestMutation } from '../../lib/fasterdom/fasterdom';
import {
  getCanPostInChat,
  getForumComposerPlaceholder,
  getHasAdminRight,
  getIsSavedDialog,
  getMessageSendingRestrictionReason,
  isChatChannel,
  isChatGroup,
  isChatSuperGroup,
  isUserId,
  isUserRightBanned,
} from '../../global/helpers';
import {
  selectBot,
  selectCanAnimateInterface,
  selectChat,
  selectChatFullInfo,
  selectCurrentMessageList,
  selectCurrentMiddleSearch,
  selectDraft,
  selectIsChatBotNotStarted,
  selectIsInSelectMode,
  selectIsRightColumnShown,
  selectIsUserBlocked,
  selectPinnedIds,
  selectTabState,
  selectTheme,
  selectThreadInfo,
  selectTopic,
  selectTopics,
  selectUserFullInfo,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import {
  IS_ANDROID, IS_ELECTRON, IS_IOS, IS_SAFARI, IS_TRANSLATION_SUPPORTED, MASK_IMAGE_DISABLED,
} from '../../util/windowEnvironment';
import calculateMiddleFooterTransforms from './helpers/calculateMiddleFooterTransforms';

import useAppLayout from '../../hooks/useAppLayout';
import useCustomBackground from '../../hooks/useCustomBackground';
import useForceUpdate from '../../hooks/useForceUpdate';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import usePrevDuringAnimation from '../../hooks/usePrevDuringAnimation';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';
import { useResize } from '../../hooks/useResize';
import useSyncEffect from '../../hooks/useSyncEffect';
import useWindowSize from '../../hooks/window/useWindowSize';
import usePinnedMessage from './hooks/usePinnedMessage';
import useFluidBackgroundFilter from './message/hooks/useFluidBackgroundFilter';

import Composer from '../common/Composer';
import Icon from '../common/icons/Icon';
import PrivacySettingsNoticeModal from '../common/PrivacySettingsNoticeModal.async';
import SeenByModal from '../common/SeenByModal.async';
import UnpinAllMessagesModal from '../common/UnpinAllMessagesModal.async';
import Button from '../ui/Button';
import Transition from '../ui/Transition';
import ChatLanguageModal from './ChatLanguageModal.async';
import { DropAreaState } from './composer/DropArea';
import EmojiInteractionAnimation from './EmojiInteractionAnimation.async';
import FloatingActionButtons from './FloatingActionButtons';
import MessageList from './MessageList';
import MessageSelectToolbar from './MessageSelectToolbar.async';
import MiddleHeader from './MiddleHeader';
import MiddleHeaderPanes from './MiddleHeaderPanes';
import PremiumRequiredPlaceholder from './PremiumRequiredPlaceholder';
import ReactorListModal from './ReactorListModal.async';
import MiddleSearch from './search/MiddleSearch.async';

import './MiddleColumn.scss';
import styles from './MiddleColumn.module.scss';

interface OwnProps {
  leftColumnRef: React.RefObject<HTMLDivElement>;
  isMobile?: boolean;
}

type StateProps = {
  chatId?: string;
  threadId?: ThreadId;
  isComments?: boolean;
  messageListType?: MessageListType;
  chat?: ApiChat;
  draftReplyInfo?: ApiInputMessageReplyInfo;
  isPrivate?: boolean;
  isPinnedMessageList?: boolean;
  canPost?: boolean;
  currentUserBannedRights?: ApiChatBannedRights;
  defaultBannedRights?: ApiChatBannedRights;
  pinnedMessagesCount?: number;
  theme: ThemeKey;
  customBackground?: string;
  backgroundColor?: string;
  patternColor?: string;
  isLeftColumnShown?: boolean;
  isRightColumnShown?: boolean;
  isBackgroundBlurred?: boolean;
  leftColumnWidth?: number;
  hasActiveMiddleSearch?: boolean;
  isSelectModeActive?: boolean;
  isSeenByModalOpen: boolean;
  isPrivacySettingsNoticeModalOpen: boolean;
  isReactorListModalOpen: boolean;
  isChatLanguageModalOpen?: boolean;
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
  pinnedIds?: number[];
  canUnpin?: boolean;
  canUnblock?: boolean;
  isSavedDialog?: boolean;
  canShowOpenChatButton?: boolean;
  isContactRequirePremium?: boolean;
  topics?: Record<number, ApiTopic>;
};

function isImage(item: DataTransferItem) {
  return item.kind === 'file' && item.type && SUPPORTED_PHOTO_CONTENT_TYPES.has(item.type);
}

function isVideo(item: DataTransferItem) {
  return item.kind === 'file' && item.type && SUPPORTED_VIDEO_CONTENT_TYPES.has(item.type);
}

const LAYER_ANIMATION_DURATION_MS = 450 + ANIMATION_END_DELAY;

function MiddleColumn({
  leftColumnRef,
  chatId,
  threadId,
  isComments,
  messageListType,
  isMobile,
  chat,
  draftReplyInfo,
  isPrivate,
  isPinnedMessageList,
  canPost,
  currentUserBannedRights,
  defaultBannedRights,
  pinnedMessagesCount,
  customBackground,
  theme,
  backgroundColor,
  patternColor,
  isLeftColumnShown,
  isRightColumnShown,
  isBackgroundBlurred,
  leftColumnWidth,
  hasActiveMiddleSearch,
  isSelectModeActive,
  isSeenByModalOpen,
  isPrivacySettingsNoticeModalOpen,
  isReactorListModalOpen,
  isChatLanguageModalOpen,
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
  pinnedIds,
  canUnpin,
  canUnblock,
  isSavedDialog,
  canShowOpenChatButton,
  isContactRequirePremium,
  topics,
}: OwnProps & StateProps) {
  const {
    openChat,
    openPreviousChat,
    unpinAllMessages,
    loadUser,
    loadChatSettings,
    exitMessageSelectMode,
    joinChannel,
    sendBotCommand,
    restartBot,
    showNotification,
    loadFullChat,
    setLeftColumnWidth,
    resetLeftColumnWidth,
    unblockUser,
  } = getActions();

  const { width: windowWidth } = useWindowSize();
  const { isTablet, isDesktop } = useAppLayout();

  const lang = useOldLang();
  const [dropAreaState, setDropAreaState] = useState(DropAreaState.None);
  const [isScrollDownNeeded, setIsScrollDownShown] = useState(false);
  const isScrollDownShown = isScrollDownNeeded && (!isMobile || !hasActiveMiddleSearch);
  const [isNotchShown, setIsNotchShown] = useState<boolean | undefined>();
  const [isUnpinModalOpen, setIsUnpinModalOpen] = useState(false);

  const {
    handleIntersectPinnedMessage,
    handleFocusPinnedMessage,
    getCurrentPinnedIndex,
    getLoadingPinnedId,
  } = usePinnedMessage(chatId, threadId, pinnedIds);

  const closeAnimationDuration = isMobile ? LAYER_ANIMATION_DURATION_MS : undefined;

  const renderingChatId = usePrevDuringAnimation(chatId, closeAnimationDuration);
  const renderingThreadId = usePrevDuringAnimation(threadId, closeAnimationDuration);
  const renderingMessageListType = usePrevDuringAnimation(messageListType, closeAnimationDuration);
  const renderingCanSubscribe = usePrevDuringAnimation(canSubscribe, closeAnimationDuration);
  const renderingCanStartBot = usePrevDuringAnimation(canStartBot, closeAnimationDuration);
  const renderingCanRestartBot = usePrevDuringAnimation(canRestartBot, closeAnimationDuration);
  const renderingCanUnblock = usePrevDuringAnimation(canUnblock, closeAnimationDuration);
  const renderingCanPost = usePrevDuringAnimation(canPost, closeAnimationDuration)
    && !renderingCanRestartBot && !renderingCanStartBot && !renderingCanSubscribe && !renderingCanUnblock
    && chatId !== TMP_CHAT_ID && !isContactRequirePremium;
  const renderingIsScrollDownShown = usePrevDuringAnimation(
    isScrollDownShown, closeAnimationDuration,
  ) && chatId !== TMP_CHAT_ID;
  const renderingIsChannel = usePrevDuringAnimation(isChannel, closeAnimationDuration);
  const renderingShouldJoinToSend = usePrevDuringAnimation(shouldJoinToSend, closeAnimationDuration);
  const renderingShouldSendJoinRequest = usePrevDuringAnimation(shouldSendJoinRequest, closeAnimationDuration);
  const renderingHandleIntersectPinnedMessage = usePrevDuringAnimation(
    chatId ? handleIntersectPinnedMessage : undefined,
    closeAnimationDuration,
  );

  const prevTransitionKey = usePreviousDeprecated(currentTransitionKey);

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

        requestMeasure(() => {
          if (!isFixNeeded && visualViewport.offsetTop) {
            requestMutation(() => {
              window.scrollTo({ top: 0 });
            });
          }
        });
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
    if (!areChatSettingsLoaded) {
      loadChatSettings({ chatId: chatId! });
    }
  }, [chatId, isPrivate, areChatSettingsLoaded]);

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
    // In Safari, the e.dataTransfer.items list may be empty during dragenter/dragover events,
    // preventing the ability to determine file types in advance. More details: https://bugs.webkit.org/show_bug.cgi?id=223517
    const shouldDrawQuick = IS_SAFARI || (items && items.length > 0 && Array.from(items)
      // Filter unnecessary element for drag and drop images in Firefox (https://github.com/Ajaxy/telegram-tt/issues/49)
      // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Recommended_drag_types#image
      .filter((item) => item.type !== 'text/uri-list')
      .every((item) => isImage(item) || isVideo(item)));

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

  const handleOpenChatFromSaved = useLastCallback(() => {
    openChat({ id: String(threadId) });
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

  const handleUnblock = useLastCallback(() => {
    unblockUser({ userId: chatId! });
  });

  const customBackgroundValue = useCustomBackground(theme, customBackground);

  const className = buildClassName(
    MASK_IMAGE_DISABLED ? 'mask-image-disabled' : 'mask-image-enabled',
  );

  const bgClassName = buildClassName(
    styles.background,
    styles.withTransition,
    customBackground && styles.customBgImage,
    backgroundColor && styles.customBgColor,
    customBackground && isBackgroundBlurred && styles.blurred,
    isRightColumnShown && styles.withRightColumn,
    IS_ELECTRON && !(renderingChatId && renderingThreadId) && styles.draggable,
  );

  const messagingDisabledClassName = buildClassName(
    'messaging-disabled',
    !isSelectModeActive && 'shown',
  );

  const messageSendingRestrictionReason = getMessageSendingRestrictionReason(
    lang, currentUserBannedRights, defaultBannedRights,
  );
  const forumComposerPlaceholder = getForumComposerPlaceholder(lang, chat, threadId, topics, Boolean(draftReplyInfo));

  const composerRestrictionMessage = messageSendingRestrictionReason
    ?? forumComposerPlaceholder
    ?? (isContactRequirePremium ? <PremiumRequiredPlaceholder userId={chatId!} /> : undefined);

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

  // Prepare filter beforehand to avoid flickering
  useFluidBackgroundFilter(patternColor);

  const isMessagingDisabled = Boolean(
    !isPinnedMessageList && !isSavedDialog && !renderingCanPost && !renderingCanRestartBot && !renderingCanStartBot
    && !renderingCanSubscribe && composerRestrictionMessage,
  );
  const withMessageListBottomShift = Boolean(
    renderingCanRestartBot || renderingCanSubscribe || renderingShouldSendJoinRequest || renderingCanStartBot
    || (isPinnedMessageList && canUnpin) || canShowOpenChatButton || renderingCanUnblock,
  );
  const withExtraShift = Boolean(isMessagingDisabled || isSelectModeActive);

  return (
    <div
      id="MiddleColumn"
      className={className}
      onTransitionEnd={handleCssTransitionEnd}
      style={buildStyle(
        `--composer-hidden-scale: ${composerHiddenScale}`,
        `--toolbar-hidden-scale: ${toolbarHiddenScale}`,
        `--unpin-hidden-scale: ${unpinHiddenScale}`,
        `--toolbar-unpin-hidden-scale: ${toolbarForUnpinHiddenScale},`,
        `--composer-translate-x: ${composerTranslateX}px`,
        `--toolbar-translate-x: ${toolbarTranslateX}px`,
        `--pattern-color: ${patternColor}`,
        backgroundColor && `--theme-background-color: ${backgroundColor}`,
      )}
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
            <MiddleHeaderPanes
              key={renderingChatId}
              chatId={renderingChatId!}
              threadId={renderingThreadId!}
              messageListType={renderingMessageListType!}
              getCurrentPinnedIndex={getCurrentPinnedIndex}
              getLoadingPinnedId={getLoadingPinnedId}
              onFocusPinnedMessage={handleFocusPinnedMessage}
            />
            <MiddleHeader
              chatId={renderingChatId!}
              threadId={renderingThreadId!}
              messageListType={renderingMessageListType!}
              isComments={isComments}
              isMobile={isMobile}
              getCurrentPinnedIndex={getCurrentPinnedIndex}
              getLoadingPinnedId={getLoadingPinnedId}
              onFocusPinnedMessage={handleFocusPinnedMessage}
            />
            <Transition
              name={shouldSkipHistoryAnimations ? 'none' : withInterfaceAnimations ? 'slide' : 'fade'}
              activeKey={currentTransitionKey}
              shouldCleanup
              cleanupExceptionKey={cleanupExceptionKey}
              isBlockingAnimation
              onStop={handleSlideTransitionStop}
            >
              <MessageList
                key={`${renderingChatId}-${renderingThreadId}-${renderingMessageListType}`}
                chatId={renderingChatId!}
                threadId={renderingThreadId!}
                type={renderingMessageListType!}
                isComments={isComments}
                canPost={renderingCanPost!}
                onScrollDownToggle={setIsScrollDownShown}
                onNotchToggle={setIsNotchShown}
                isReady={isReady}
                isContactRequirePremium={isContactRequirePremium}
                withBottomShift={withMessageListBottomShift}
                withDefaultBg={Boolean(!customBackground && !backgroundColor)}
                onIntersectPinnedMessage={renderingHandleIntersectPinnedMessage!}
              />
              <div className={footerClassName}>
                {renderingCanPost && (
                  <Composer
                    type="messageList"
                    chatId={renderingChatId!}
                    threadId={renderingThreadId!}
                    messageListType={renderingMessageListType!}
                    dropAreaState={dropAreaState}
                    onDropHide={handleHideDropArea}
                    isReady={isReady}
                    isMobile={isMobile}
                    editableInputId={EDITABLE_INPUT_ID}
                    editableInputCssSelector={EDITABLE_INPUT_CSS_SELECTOR}
                    inputId="message-input-text"
                  />
                )}
                {isPinnedMessageList && canUnpin && (
                  <div className="middle-column-footer-button-container" dir={lang.isRtl ? 'rtl' : undefined}>
                    <Button
                      size="tiny"
                      fluid
                      color="secondary"
                      className="composer-button unpin-all-button"
                      onClick={handleOpenUnpinModal}
                    >
                      <Icon name="unpin" />
                      <span>{lang('Chat.Pinned.UnpinAll', pinnedMessagesCount, 'i')}</span>
                    </Button>
                  </div>
                )}
                {canShowOpenChatButton && (
                  <div className="middle-column-footer-button-container" dir={lang.isRtl ? 'rtl' : undefined}>
                    <Button
                      size="tiny"
                      fluid
                      color="secondary"
                      className="composer-button open-chat-button"
                      onClick={handleOpenChatFromSaved}
                    >
                      <span>{lang('SavedOpenChat')}</span>
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
                      className="composer-button join-subscribe-button"
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
                      className="composer-button join-subscribe-button"
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
                      className="composer-button join-subscribe-button"
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
                      className="composer-button join-subscribe-button"
                      onClick={handleRestartBot}
                    >
                      {lang('BotRestart')}
                    </Button>
                  </div>
                )}
                {isMobile && renderingCanUnblock && (
                  <div className="middle-column-footer-button-container" dir={lang.isRtl ? 'rtl' : undefined}>
                    <Button
                      size="tiny"
                      fluid
                      ripple
                      className="composer-button join-subscribe-button"
                      onClick={handleUnblock}
                    >
                      {lang('Unblock')}
                    </Button>
                  </div>
                )}
                <MessageSelectToolbar
                  messageListType={renderingMessageListType}
                  isActive={isSelectModeActive}
                  canPost={renderingCanPost}
                />
                <SeenByModal isOpen={isSeenByModalOpen} />
                <PrivacySettingsNoticeModal isOpen={isPrivacySettingsNoticeModalOpen} />
                <ReactorListModal isOpen={isReactorListModalOpen} />
                {IS_TRANSLATION_SUPPORTED && <ChatLanguageModal isOpen={isChatLanguageModalOpen} />}
              </div>
            </Transition>

            <FloatingActionButtons
              withScrollDown={renderingIsScrollDownShown}
              canPost={renderingCanPost}
              withExtraShift={withExtraShift}
            />
          </div>
          <MiddleSearch isActive={Boolean(hasActiveMiddleSearch)} />
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
      seenByModal, reactorModal, shouldSkipHistoryAnimations,
      chatLanguageModal, privacySettingsNoticeModal,
    } = selectTabState(global);
    const currentMessageList = selectCurrentMessageList(global);
    const { leftColumnWidth } = global;

    const state: StateProps = {
      theme,
      customBackground,
      backgroundColor,
      patternColor,
      isLeftColumnShown,
      isRightColumnShown: selectIsRightColumnShown(global, isMobile),
      isBackgroundBlurred,
      hasActiveMiddleSearch: Boolean(selectCurrentMiddleSearch(global)),
      isSelectModeActive: selectIsInSelectMode(global),
      isSeenByModalOpen: Boolean(seenByModal),
      isPrivacySettingsNoticeModalOpen: Boolean(privacySettingsNoticeModal),
      isReactorListModalOpen: Boolean(reactorModal),
      isChatLanguageModalOpen: Boolean(chatLanguageModal),
      withInterfaceAnimations: selectCanAnimateInterface(global),
      currentTransitionKey: Math.max(0, messageLists.length - 1),
      activeEmojiInteractions,
      leftColumnWidth,
    };

    if (!currentMessageList) {
      return state;
    }

    const { chatId, threadId, type: messageListType } = currentMessageList;
    const isPrivate = isUserId(chatId);
    const chat = selectChat(global, chatId);
    const bot = selectBot(global, chatId);
    const pinnedIds = selectPinnedIds(global, chatId, threadId);
    const chatFullInfo = chatId ? selectChatFullInfo(global, chatId) : undefined;

    const threadInfo = selectThreadInfo(global, chatId, threadId);
    const isMessageThread = Boolean(!threadInfo?.isCommentsInfo && threadInfo?.fromChannelId);
    const topic = selectTopic(global, chatId, threadId);
    const canPost = chat && getCanPostInChat(chat, topic, isMessageThread, chatFullInfo);
    const isBotNotStarted = selectIsChatBotNotStarted(global, chatId);
    const isPinnedMessageList = messageListType === 'pinned';
    const isMainThread = messageListType === 'thread' && threadId === MAIN_THREAD_ID;
    const isChannel = Boolean(chat && isChatChannel(chat));
    const canSubscribe = Boolean(
      chat && isMainThread && (isChannel || isChatSuperGroup(chat)) && chat.isNotJoined && !chat.joinRequests,
    );
    const shouldJoinToSend = Boolean(chat?.isNotJoined && chat.isJoinToSend);
    const shouldSendJoinRequest = Boolean(chat?.isNotJoined && chat.isJoinRequest);
    const isUserBlocked = isPrivate ? selectIsUserBlocked(global, chatId) : false;
    const canRestartBot = Boolean(bot && isUserBlocked);
    const canStartBot = !canRestartBot && isBotNotStarted;
    const canUnblock = isUserBlocked && !bot;
    const shouldLoadFullChat = Boolean(
      chat && isChatGroup(chat) && !chatFullInfo,
    );
    const draftReplyInfo = selectDraft(global, chatId, threadId)?.replyInfo;
    const shouldBlockSendInForum = chat?.isForum
      ? threadId === MAIN_THREAD_ID && !draftReplyInfo && (selectTopic(global, chatId, GENERAL_TOPIC_ID)?.isClosed)
      : false;
    const topics = selectTopics(global, chatId);

    const isSavedDialog = getIsSavedDialog(chatId, threadId, global.currentUserId);
    const canShowOpenChatButton = isSavedDialog && threadId !== ANONYMOUS_USER_ID;

    const canUnpin = chat && (
      isPrivate || (
        chat?.isCreator || (!isChannel && !isUserRightBanned(chat, 'pinMessages'))
          || getHasAdminRight(chat, 'pinMessages')
      )
    );

    const isContactRequirePremium = selectUserFullInfo(global, chatId)?.isContactRequirePremium;

    return {
      ...state,
      chatId,
      threadId,
      messageListType,
      chat,
      draftReplyInfo,
      isPrivate,
      areChatSettingsLoaded: Boolean(chat?.settings),
      isComments: isMessageThread,
      canPost:
        !isPinnedMessageList
        && (!chat || canPost)
        && !isBotNotStarted
        && !(shouldJoinToSend && chat?.isNotJoined)
        && !shouldBlockSendInForum
        && !isSavedDialog,
      isPinnedMessageList,
      currentUserBannedRights: chat?.currentUserBannedRights,
      defaultBannedRights: chat?.defaultBannedRights,
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
      canUnpin,
      canUnblock,
      isSavedDialog,
      canShowOpenChatButton,
      isContactRequirePremium,
      topics,
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
