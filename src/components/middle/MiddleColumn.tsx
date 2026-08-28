import type { ElementRef } from '@teact';
import { memo, useEffect, useRef, useState } from '@teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat, ApiChatBannedRights, ApiInputDraftReplyInfo, ApiTopic } from '../../api/types';
import type { ActiveEmojiInteraction, AnimationLevel, MessageListType, ThemeKey, ThreadId } from '../../types';
import type { PaneState } from './hooks/useHeaderPane';
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
  isUserRightBanned,
} from '../../global/helpers';
import { getIsChatMuted } from '../../global/helpers/notifications';
import {
  selectActionMessageBg,
  selectBot,
  selectCanAnimateInterface, selectCanAnimateRightColumn,
  selectChat,
  selectChatFullInfo,
  selectCurrentMessageList,
  selectCurrentMiddleSearch,
  selectIsChatBotNotStarted,
  selectIsCurrentUserFrozen,
  selectIsInSelectMode,
  selectIsMonoforumAdmin,
  selectIsRightColumnShown,
  selectIsUserBlocked,
  selectNotifyDefaults,
  selectNotifyException,
  selectPeerPaidMessagesStars,
  selectPinnedIds,
  selectTabState,
  selectTheme,
  selectThemeValues,
  selectTopic,
  selectTopics,
  selectUserFullInfo,
} from '../../global/selectors';
import { selectSharedSettings } from '../../global/selectors/sharedState';
import { selectDraft, selectEditingId, selectThreadInfo } from '../../global/selectors/threads';
import {
  IS_ANDROID, IS_IOS, IS_SAFARI, IS_TRANSLATION_SUPPORTED, MASK_IMAGE_DISABLED,
} from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { waitForTransitionEnd } from '../../util/cssAnimationEndListeners';
import { isUserId } from '../../util/entities/ids';
import { resolveTransitionName } from '../../util/resolveTransitionName';
import getHasMiddleFooter, { getHasFooterActionBar } from './helpers/getHasMiddleFooter';
import { measureFooterContentHeight, syncMessageListBottomReserve } from './helpers/messageListReserves';

import useAppLayout from '../../hooks/useAppLayout';
import useDebouncedCallback from '../../hooks/useDebouncedCallback';
import useForceUpdate from '../../hooks/useForceUpdate';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import usePrevDuringAnimation from '../../hooks/usePrevDuringAnimation';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';
import { useResize } from '../../hooks/useResize';
import useSyncEffect from '../../hooks/useSyncEffect';
import usePinnedMessage from './hooks/usePinnedMessage';
import useFluidBackgroundFilter from './message/hooks/useFluidBackgroundFilter';

import Composer from '../common/Composer';
import PrivacySettingsNoticeModal from '../common/PrivacySettingsNoticeModal.async';
import SeenByModal from '../common/SeenByModal.async';
import UnpinAllMessagesModal from '../common/UnpinAllMessagesModal.async';
import Transition from '../ui/Transition';
import ChatLanguageModal from './ChatLanguageModal.async';
import { DropAreaState } from './composer/DropArea';
import EmojiInteractionAnimation from './EmojiInteractionAnimation.async';
import FloatingActionButtons from './FloatingActionButtons';
import FooterActionBar from './footer/FooterActionBar';
import FrozenAccountPlaceholder from './FrozenAccountPlaceholder';
import MessageList from './MessageList';
import MessageSelectToolbar from './MessageSelectToolbar';
import MiddleHeader from './MiddleHeader';
import MiddleHeaderPanesIsland from './MiddleHeaderPanesIsland';
import AudioPlayer from './panes/AudioPlayer';
import PremiumRequiredPlaceholder from './PremiumRequiredPlaceholder';
import ReactorListModal from './ReactorListModal.async';
import MiddleSearch from './search/MiddleSearch.async';

import './MiddleColumn.scss';

interface OwnProps {
  leftColumnRef: ElementRef<HTMLDivElement>;
  isMobile?: boolean;
  onPlayerPaneStateChange: (state: PaneState) => void;
}

type StateProps = {
  chatId?: string;
  threadId?: ThreadId;
  isComments?: boolean;
  messageListType?: MessageListType;
  chat?: ApiChat;
  draftReplyInfo?: ApiInputDraftReplyInfo;
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
  actionMessageBg?: string;
  isLeftColumnShown?: boolean;
  isRightColumnShown?: boolean;
  isBackgroundBlurred?: boolean;
  leftColumnWidth?: number;
  hasActiveMiddleSearch?: boolean;
  isRichInputExpanded?: boolean;
  isSelectModeActive?: boolean;
  isSeenByModalOpen: boolean;
  isPrivacySettingsNoticeModalOpen: boolean;
  isReactorListModalOpen: boolean;
  isChatLanguageModalOpen?: boolean;
  animationLevel: AnimationLevel;
  withInterfaceAnimations?: boolean;
  withRightColumnAnimation?: boolean;
  shouldSkipHistoryAnimations?: boolean;
  currentTransitionKey: number;
  isChannel?: boolean;
  arePeerSettingsLoaded?: boolean;
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
  isChannelMuteBar?: boolean;
  isMuted?: boolean;
  linkedMonoforumId?: string;
  areGiftsAvailable?: boolean;
  isSavedDialog?: boolean;
  canShowOpenChatButton?: boolean;
  isContactRequirePremium?: boolean;
  topics?: Record<number, ApiTopic>;
  paidMessagesStars?: number;
  isAccountFrozen?: boolean;
  freezeAppealChat?: ApiChat;
  shouldBlockSendInMonoforum?: boolean;
  isUiReady?: boolean;
};

function isImage(item: DataTransferItem) {
  return item.kind === 'file' && item.type && SUPPORTED_PHOTO_CONTENT_TYPES.has(item.type);
}

function isVideo(item: DataTransferItem) {
  return item.kind === 'file' && item.type && SUPPORTED_VIDEO_CONTENT_TYPES.has(item.type);
}

const LAYER_ANIMATION_DURATION_MS = 450 + ANIMATION_END_DELAY;
const KEYBOARD_SETTLE_DURATION = 400;

function MiddleColumn({
  leftColumnRef,
  chatId,
  threadId,
  isComments,
  messageListType,
  isMobile,
  onPlayerPaneStateChange,
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
  actionMessageBg,
  isLeftColumnShown,
  isRightColumnShown,
  isBackgroundBlurred,
  leftColumnWidth,
  hasActiveMiddleSearch,
  isRichInputExpanded,
  isSelectModeActive,
  isSeenByModalOpen,
  isPrivacySettingsNoticeModalOpen,
  isReactorListModalOpen,
  isChatLanguageModalOpen,
  animationLevel,
  withInterfaceAnimations,
  withRightColumnAnimation,
  shouldSkipHistoryAnimations,
  currentTransitionKey,
  isChannel,
  arePeerSettingsLoaded,
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
  isChannelMuteBar,
  isMuted,
  linkedMonoforumId,
  areGiftsAvailable,
  isSavedDialog,
  canShowOpenChatButton,
  isContactRequirePremium,
  topics,
  paidMessagesStars,
  isAccountFrozen,
  freezeAppealChat,
  shouldBlockSendInMonoforum,
  isUiReady,
}: OwnProps & StateProps) {
  const {
    openChat,
    openPreviousChat,
    unpinAllMessages,
    loadUser,
    loadPeerSettings,
    exitMessageSelectMode,
    loadFullChat,
    setLeftColumnWidth,
    resetLeftColumnWidth,
  } = getActions();

  const { isTablet, isDesktop } = useAppLayout();

  const oldLang = useOldLang();
  const lang = useLang();
  const [dropAreaState, setDropAreaState] = useState(DropAreaState.None);
  const [isScrollDownNeeded, setIsScrollDownNeeded] = useState(false);
  const isScrollDownShown = isScrollDownNeeded && (!isMobile || !hasActiveMiddleSearch);
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
  const renderingIsChannelMuteBar = usePrevDuringAnimation(isChannelMuteBar, closeAnimationDuration);
  const renderingIsMuted = usePrevDuringAnimation(isMuted, closeAnimationDuration);
  const renderingLinkedMonoforumId = usePrevDuringAnimation(linkedMonoforumId, closeAnimationDuration);
  const renderingAreGiftsAvailable = usePrevDuringAnimation(areGiftsAvailable, closeAnimationDuration);
  const renderingHandleIntersectPinnedMessage = usePrevDuringAnimation(
    chatId ? handleIntersectPinnedMessage : undefined,
    closeAnimationDuration,
  );

  const prevTransitionKey = usePreviousDeprecated(currentTransitionKey);

  const cleanupExceptionKey = (
    prevTransitionKey !== undefined && prevTransitionKey < currentTransitionKey ? prevTransitionKey : undefined
  );

  const middleColumnRef = useRef<HTMLDivElement>();
  const isViewportAnimatingRef = useRef(false);
  const getIsKeyboardAnimating = useLastCallback(() => isViewportAnimatingRef.current);

  const syncFooterSlide = useLastCallback((footer: HTMLElement) => {
    if (!footer.offsetParent) return;

    const contentHeight = measureFooterContentHeight(footer);
    requestMutation(() => {
      footer.style.setProperty('--middle-footer-content-height', `${contentHeight}px`);
    });

    const scroller = footer.parentElement?.querySelector<HTMLElement>('.MessageList');
    if (scroller) syncMessageListBottomReserve(scroller, getIsKeyboardAnimating());
  });

  const updateFooterHeight = useLastCallback(() => {
    const middleColumn = middleColumnRef.current;
    if (!middleColumn) return;

    middleColumn.querySelectorAll<HTMLElement>('.middle-column-footer').forEach((footer) => {
      syncFooterSlide(footer);
    });
  });

  const markViewportSettled = useDebouncedCallback(() => {
    isViewportAnimatingRef.current = false;
    updateFooterHeight();
  }, [updateFooterHeight], KEYBOARD_SETTLE_DURATION, true, false);

  useEffect(() => {
    const middleColumn = middleColumnRef.current;
    if (!middleColumn) return undefined;

    updateFooterHeight();

    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => syncFooterSlide(entry.target as HTMLElement));
    });
    middleColumn.querySelectorAll<HTMLElement>('.middle-column-footer').forEach((footer) => {
      observer.observe(footer, { box: 'border-box' });
    });

    return () => observer.disconnect();
  }, [currentTransitionKey, renderingChatId, renderingThreadId, updateFooterHeight, syncFooterSlide]);

  const { isReady, handleSlideTransitionStop } = useIsReady(
    !shouldSkipHistoryAnimations && withInterfaceAnimations,
    currentTransitionKey,
    prevTransitionKey,
    chatId,
    isMobile,
    isLeftColumnShown,
    middleColumnRef,
  );

  useEffect(() => {
    return chatId
      ? captureEscKeyListener(() => {
        // Let the Right Column (profile, management, etc.) handle Esc first while it is open
        if (isRightColumnShown) return false;
        openChat({ id: undefined });
        return undefined;
      })
      : undefined;
  }, [chatId, openChat, isRightColumnShown]);

  useSyncEffect(() => {
    setDropAreaState(DropAreaState.None);
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
      isViewportAnimatingRef.current = true;
      markViewportSettled();

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
  }, [markViewportSettled]);

  useEffect(() => {
    if (isPrivate) {
      loadUser({ userId: chatId! });
    }
  }, [chatId, isPrivate, loadUser]);

  useEffect(() => {
    if (!arePeerSettingsLoaded) {
      loadPeerSettings({ peerId: chatId! });
    }
  }, [chatId, isPrivate, arePeerSettingsLoaded]);

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

  const handleUnpinAllMessages = useLastCallback(() => {
    unpinAllMessages({ chatId: chatId!, threadId: threadId! });
    closeUnpinModal();
    openPreviousChat();
  });

  const handleTabletFocus = useLastCallback(() => {
    openChat({ id: chatId });
  });

  const className = buildClassName(
    MASK_IMAGE_DISABLED ? 'mask-image-disabled' : 'mask-image-enabled',
    isUiReady && 'ui-ready',
  );

  const messagingDisabledClassName = buildClassName(
    'messaging-disabled',
    !isSelectModeActive && 'shown',
  );

  const messageSendingRestrictionReason = getMessageSendingRestrictionReason(
    oldLang, currentUserBannedRights, defaultBannedRights,
  );
  const forumComposerPlaceholder = getForumComposerPlaceholder(
    oldLang, chat, threadId, topics, Boolean(draftReplyInfo),
  );

  const composerRestrictionMessage = messageSendingRestrictionReason
    || forumComposerPlaceholder
    || (shouldBlockSendInMonoforum ? lang('MonoforumComposerPlaceholder') : undefined)
    || (isContactRequirePremium ? <PremiumRequiredPlaceholder userId={chatId!} /> : undefined)
    || (isAccountFrozen && freezeAppealChat?.id !== chatId ? <FrozenAccountPlaceholder /> : undefined);

  useHistoryBack({
    isActive: isSelectModeActive,
    onBack: exitMessageSelectMode,
  });

  // Prepare filter beforehand to avoid flickering
  useFluidBackgroundFilter(actionMessageBg);

  const isMessagingDisabled = Boolean(
    !isPinnedMessageList && !isSavedDialog && !renderingCanPost && !renderingCanRestartBot && !renderingCanStartBot
    && !renderingCanSubscribe && composerRestrictionMessage,
  ) || (isAccountFrozen && freezeAppealChat?.id !== chatId);
  const hasFooterActionBar = getHasFooterActionBar({
    isPinnedMessageList,
    canUnpin,
    canShowOpenChatButton,
    canSubscribe: renderingCanSubscribe,
    shouldJoinToSend: renderingShouldJoinToSend,
    shouldSendJoinRequest: renderingShouldSendJoinRequest,
    canStartBot: renderingCanStartBot,
    canRestartBot: renderingCanRestartBot,
    canUnblock: renderingCanUnblock,
    isChannelMuteBar: renderingIsChannelMuteBar,
  });
  const withMessageListBottomShift = hasFooterActionBar;
  const withExtraShift = Boolean(isMessagingDisabled || isSelectModeActive);

  const hasFooter = getHasMiddleFooter({
    canPost: renderingCanPost,
    withExtraShift,
    isPinnedMessageList,
    canUnpin,
    canShowOpenChatButton,
    canSubscribe: renderingCanSubscribe,
    shouldJoinToSend: renderingShouldJoinToSend,
    shouldSendJoinRequest: renderingShouldSendJoinRequest,
    canStartBot: renderingCanStartBot,
    canRestartBot: renderingCanRestartBot,
    canUnblock: renderingCanUnblock,
    isChannelMuteBar: renderingIsChannelMuteBar,
  });

  const footerClassName = buildClassName(
    'middle-column-footer',
    !renderingCanPost && 'no-composer',
    !hasFooter && 'no-content',
  );

  useEffect(() => {
    updateFooterHeight();
  }, [
    updateFooterHeight, renderingChatId, renderingThreadId, currentTransitionKey, renderingCanPost,
    isMessagingDisabled, isSelectModeActive, withMessageListBottomShift, footerClassName,
  ]);

  return (
    <div
      ref={middleColumnRef}
      id="MiddleColumn"
      className={className}
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
      <div id="middle-column-portals" />
      <AudioPlayer
        className="island-player"
        isHidden={hasActiveMiddleSearch || isRichInputExpanded || (isTablet && isLeftColumnShown)}
        onPaneStateChange={onPlayerPaneStateChange}
      />
      {Boolean(renderingChatId && renderingThreadId) && (
        <>
          <div className="messages-layout" onDragEnter={renderingCanPost ? handleDragEnter : undefined}>
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
            <MiddleHeaderPanesIsland
              chatId={renderingChatId!}
              threadId={renderingThreadId!}
              messageListType={renderingMessageListType!}
              getCurrentPinnedIndex={getCurrentPinnedIndex}
              getLoadingPinnedId={getLoadingPinnedId}
              isChatClosing={!chatId}
              onFocusPinnedMessage={handleFocusPinnedMessage}
            />
            <Transition
              name={resolveTransitionName(
                'slide',
                animationLevel,
                shouldSkipHistoryAnimations || !withInterfaceAnimations,
              )}
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
                hasFooter={hasFooter}
                onScrollDownToggle={setIsScrollDownNeeded}
                isReady={isReady}
                isContactRequirePremium={isContactRequirePremium}
                paidMessagesStars={paidMessagesStars}
                withBottomShift={withMessageListBottomShift}
                withDefaultBg={Boolean(!customBackground && !backgroundColor)}
                onIntersectPinnedMessage={renderingHandleIntersectPinnedMessage}
              />
              <div className={footerClassName}>
                <FloatingActionButtons
                  withScrollDown={renderingIsScrollDownShown}
                />
                {renderingCanPost && !hasFooterActionBar && (
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
                {isMessagingDisabled && (
                  <div className={messagingDisabledClassName}>
                    <div className="messaging-disabled-inner">
                      <span>
                        {composerRestrictionMessage}
                      </span>
                    </div>
                  </div>
                )}
                {!isMessagingDisabled && (
                  <FooterActionBar
                    chatId={renderingChatId!}
                    isChannel={renderingIsChannel}
                    canSubscribe={renderingCanSubscribe}
                    shouldJoinToSend={renderingShouldJoinToSend}
                    shouldSendJoinRequest={renderingShouldSendJoinRequest}
                    canStartBot={renderingCanStartBot}
                    canRestartBot={renderingCanRestartBot}
                    canUnblock={renderingCanUnblock}
                    isChannelMuteBar={renderingIsChannelMuteBar}
                    isMuted={renderingIsMuted}
                    linkedMonoforumId={renderingLinkedMonoforumId}
                    areGiftsAvailable={renderingAreGiftsAvailable}
                    canUnpinAll={Boolean(isPinnedMessageList && canUnpin)}
                    pinnedMessagesCount={pinnedMessagesCount}
                    canOpenSavedChat={canShowOpenChatButton}
                    savedChatId={canShowOpenChatButton ? String(renderingThreadId) : undefined}
                    onUnpinAll={handleOpenUnpinModal}
                  />
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
  (global, { isMobile }): Complete<StateProps> => {
    const theme = selectTheme(global);
    const {
      isBlurred: isBackgroundBlurred, background: customBackground, backgroundColor, patternColor,
    } = selectThemeValues(global, theme) || {};

    const {
      messageLists, isLeftColumnShown, activeEmojiInteractions,
      seenByModal, reactorModal, shouldSkipHistoryAnimations,
      chatLanguageModal, privacySettingsNoticeModal,
      uiReadyState, isRichInputExpanded,
    } = selectTabState(global);
    const currentMessageList = selectCurrentMessageList(global);
    const { leftColumnWidth } = global;

    const state: StateProps = {
      theme,
      customBackground,
      backgroundColor,
      patternColor,
      actionMessageBg: selectActionMessageBg(global),
      isLeftColumnShown,
      isRightColumnShown: selectIsRightColumnShown(global, isMobile),
      isBackgroundBlurred,
      hasActiveMiddleSearch: Boolean(selectCurrentMiddleSearch(global)),
      isRichInputExpanded,
      isSelectModeActive: selectIsInSelectMode(global),
      isSeenByModalOpen: Boolean(seenByModal),
      isPrivacySettingsNoticeModalOpen: Boolean(privacySettingsNoticeModal),
      isReactorListModalOpen: Boolean(reactorModal),
      isChatLanguageModalOpen: Boolean(chatLanguageModal),
      animationLevel: selectSharedSettings(global).animationLevel,
      withInterfaceAnimations: selectCanAnimateInterface(global),
      withRightColumnAnimation: selectCanAnimateRightColumn(global),
      currentTransitionKey: Math.max(0, messageLists.length - 1),
      activeEmojiInteractions,
      leftColumnWidth,
      isUiReady: uiReadyState >= 1,
    };

    if (!currentMessageList) {
      return state as Complete<StateProps>;
    }

    const { chatId, threadId, type: messageListType } = currentMessageList;
    const isPrivate = isUserId(chatId);
    const chat = selectChat(global, chatId);
    const bot = selectBot(global, chatId);
    const pinnedIds = selectPinnedIds(global, chatId, threadId);
    const chatFullInfo = chatId ? selectChatFullInfo(global, chatId) : undefined;
    const userFullInfo = chatId ? selectUserFullInfo(global, chatId) : undefined;

    const editingId = selectEditingId(global, chatId, threadId);

    const threadInfo = selectThreadInfo(global, chatId, threadId);
    const isMessageThread = Boolean(!threadInfo?.isCommentsInfo && threadInfo?.fromChannelId);
    const topic = selectTopic(global, chatId, threadId);
    const canPost = chat && getCanPostInChat(chat, topic, isMessageThread, chatFullInfo);
    const isBotNotStarted = selectIsChatBotNotStarted(global, chatId);
    const isPinnedMessageList = messageListType === 'pinned';
    const isMainThread = messageListType === 'thread' && threadId === MAIN_THREAD_ID;
    const isChannel = Boolean(chat && isChatChannel(chat));
    const canSubscribe = Boolean(
      chat && (isMainThread || chat.isForum) && (isChannel || isChatSuperGroup(chat)) && chat.isNotJoined
      && !chat.joinRequests && !chat.isMonoforum,
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
    const isMonoforumAdmin = selectIsMonoforumAdmin(global, chatId);
    const shouldBlockSendInMonoforum = Boolean(chat?.isMonoforum && !draftReplyInfo && isMonoforumAdmin && !editingId);
    const topics = selectTopics(global, chatId);

    const isSavedDialog = getIsSavedDialog(chatId, threadId, global.currentUserId);
    const canShowOpenChatButton = isSavedDialog
      && threadId !== ANONYMOUS_USER_ID
      && threadId !== global.currentUserId;

    const canUnpin = chat && (
      isPrivate || (
        (!isChannel && !isUserRightBanned(chat, 'pinMessages'))
        || getHasAdminRight(chat, 'pinMessages')
      )
    );

    const userFull = selectUserFullInfo(global, chatId);

    const isContactRequirePremium = userFull?.isContactRequirePremium;
    const paidMessagesStars = selectPeerPaidMessagesStars(global, chatId);
    const isAccountFrozen = selectIsCurrentUserFrozen(global);
    const botFreezeAppealId = global.botFreezeAppealId;
    const freezeAppealChat = botFreezeAppealId
      ? selectChat(global, botFreezeAppealId) : undefined;

    const canPostFooter = !isPinnedMessageList
      && (!chat || canPost)
      && !isBotNotStarted
      && !(shouldJoinToSend && chat?.isNotJoined)
      && !shouldBlockSendInForum
      && !shouldBlockSendInMonoforum
      && !isSavedDialog
      && (!isAccountFrozen || freezeAppealChat?.id === chatId);
    const isMuted = chat
      ? getIsChatMuted(chat, selectNotifyDefaults(global), selectNotifyException(global, chatId))
      : undefined;
    const linkedMonoforumId = chat?.linkedMonoforumId;
    const areGiftsAvailable = chatFullInfo?.areStarGiftsAvailable;
    const isChannelMuteBar = Boolean(isChannel && !chat?.isNotJoined && isMainThread && !canPostFooter);

    return {
      ...state,
      chatId,
      threadId,
      messageListType,
      chat,
      draftReplyInfo,
      isPrivate,
      arePeerSettingsLoaded: Boolean(userFullInfo?.settings),
      isComments: isMessageThread,
      canPost: canPostFooter,
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
      isChannelMuteBar,
      isMuted,
      linkedMonoforumId,
      areGiftsAvailable,
      isSavedDialog,
      canShowOpenChatButton,
      isContactRequirePremium,
      topics,
      paidMessagesStars,
      isAccountFrozen,
      freezeAppealChat,
      shouldBlockSendInMonoforum,
    } as Complete<StateProps>;
  },
)(MiddleColumn));

function useIsReady(
  withAnimations?: boolean,
  currentTransitionKey?: number,
  prevTransitionKey?: number,
  chatId?: string,
  isMobile?: boolean,
  isLeftColumnShown?: boolean,
  middleColumnRef?: ElementRef<HTMLDivElement>,
) {
  const [isReady, setIsReady] = useState(!isMobile);
  const forceUpdate = useForceUpdate();

  const willSwitchMessageList = prevTransitionKey !== undefined && prevTransitionKey !== currentTransitionKey;
  useSyncEffect(() => {
    if (!willSwitchMessageList) return;
    if (!withAnimations) {
      forceUpdate();
      return undefined;
    }
    setIsReady(false);

    // Make sure to end even if end callback was not called (which was some hardly-reproducible bug)
    window.setTimeout(() => {
      setIsReady(true);
    }, LAYER_ANIMATION_DURATION_MS);
  }, [willSwitchMessageList, withAnimations]);

  useSyncEffect(() => {
    if (!withAnimations) {
      setIsReady(true);
    }
  }, [withAnimations]);

  // Mobile only: wait until `MiddleColumn` slides in after the left column closes
  useSyncEffect(([prevIsLeftColumnShown, prevWillSwitchMessageList]) => {
    if (!isMobile) {
      return;
    }

    if (!chatId) {
      setIsReady(false);
      return;
    }

    if (!withAnimations) {
      setIsReady(true);
      return;
    }

    if (willSwitchMessageList || prevWillSwitchMessageList) {
      return;
    }

    if (isLeftColumnShown) {
      setIsReady(false);
      return;
    }

    if (prevIsLeftColumnShown !== true) {
      setIsReady(true);
      return;
    }

    waitForTransitionEnd(middleColumnRef!.current!, () => {
      setIsReady(true);
    }, 'transform', LAYER_ANIMATION_DURATION_MS);
  }, [isLeftColumnShown, willSwitchMessageList, chatId, isMobile, withAnimations, middleColumnRef]);

  function handleSlideTransitionStop() {
    setIsReady(true);
  }

  return {
    isReady: isReady && !willSwitchMessageList,
    handleSlideTransitionStop: withAnimations ? handleSlideTransitionStop : undefined,
  };
}
