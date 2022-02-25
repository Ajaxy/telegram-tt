import React, {
  FC, useEffect, useState, memo, useMemo, useCallback,
} from '../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../lib/teact/teactn';

import { ApiChatBannedRights, MAIN_THREAD_ID } from '../../api/types';
import {
  MessageListType,
  MessageList as GlobalMessageList,
  ActiveEmojiInteraction,
} from '../../global/types';
import { ThemeKey } from '../../types';

import {
  MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN,
  MOBILE_SCREEN_MAX_WIDTH,
  MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN,
  SAFE_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN,
  SAFE_SCREEN_WIDTH_FOR_CHAT_INFO,
  ANIMATION_LEVEL_MAX,
  ANIMATION_END_DELAY,
  DARK_THEME_BG_COLOR,
  LIGHT_THEME_BG_COLOR,
  ANIMATION_LEVEL_MIN,
  SUPPORTED_IMAGE_CONTENT_TYPES,
} from '../../config';
import {
  IS_SINGLE_COLUMN_LAYOUT,
  IS_TABLET_COLUMN_LAYOUT,
  IS_TOUCH_ENV,
  MASK_IMAGE_DISABLED,
} from '../../util/environment';
import { DropAreaState } from './composer/DropArea';
import {
  selectChat,
  selectChatBot,
  selectCurrentMessageList,
  selectCurrentTextSearch,
  selectIsChatBotNotStarted,
  selectIsInSelectMode,
  selectIsRightColumnShown,
  selectIsUserBlocked,
  selectPinnedIds,
  selectTheme,
} from '../../modules/selectors';
import {
  getCanPostInChat, getMessageSendingRestrictionReason, isChatChannel, isChatSuperGroup, isUserId,
} from '../../modules/helpers';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import buildClassName from '../../util/buildClassName';
import { createMessageHash } from '../../util/routing';
import useCustomBackground from '../../hooks/useCustomBackground';
import useWindowSize from '../../hooks/useWindowSize';
import usePrevDuringAnimation from '../../hooks/usePrevDuringAnimation';
import useLang from '../../hooks/useLang';
import useHistoryBack from '../../hooks/useHistoryBack';
import usePrevious from '../../hooks/usePrevious';
import useForceUpdate from '../../hooks/useForceUpdate';
import useOnChange from '../../hooks/useOnChange';
import calculateMiddleFooterTransforms from './helpers/calculateMiddleFooterTransforms';

import Transition from '../ui/Transition';
import MiddleHeader from './MiddleHeader';
import MessageList from './MessageList';
import ScrollDownButton from './ScrollDownButton';
import Composer from './composer/Composer';
import Button from '../ui/Button';
import MobileSearch from './MobileSearch.async';
import MessageSelectToolbar from './MessageSelectToolbar.async';
import UnpinAllMessagesModal from '../common/UnpinAllMessagesModal.async';
import PaymentModal from '../payment/PaymentModal.async';
import ReceiptModal from '../payment/ReceiptModal.async';
import SeenByModal from '../common/SeenByModal.async';
import EmojiInteractionAnimation from './EmojiInteractionAnimation.async';
import ReactorListModal from './ReactorListModal.async';

import './MiddleColumn.scss';

type StateProps = {
  chatId?: string;
  threadId?: number;
  messageListType?: MessageListType;
  isPrivate?: boolean;
  isPinnedMessageList?: boolean;
  isScheduledMessageList?: boolean;
  canPost?: boolean;
  currentUserBannedRights?: ApiChatBannedRights;
  defaultBannedRights?: ApiChatBannedRights;
  hasPinnedOrAudioPlayer?: boolean;
  pinnedMessagesCount?: number;
  theme: ThemeKey;
  customBackground?: string;
  backgroundColor?: string;
  patternColor?: string;
  isLeftColumnShown?: boolean;
  isRightColumnShown?: boolean;
  isBackgroundBlurred?: boolean;
  isMobileSearchActive?: boolean;
  isSelectModeActive?: boolean;
  isPaymentModalOpen?: boolean;
  isReceiptModalOpen?: boolean;
  isSeenByModalOpen: boolean;
  isReactorListModalOpen: boolean;
  animationLevel?: number;
  shouldSkipHistoryAnimations?: boolean;
  currentTransitionKey: number;
  messageLists?: GlobalMessageList[];
  isChannel?: boolean;
  canSubscribe?: boolean;
  canStartBot?: boolean;
  canRestartBot?: boolean;
  activeEmojiInteractions?: ActiveEmojiInteraction[];
};

const CLOSE_ANIMATION_DURATION = IS_SINGLE_COLUMN_LAYOUT ? 450 + ANIMATION_END_DELAY : undefined;

function isImage(item: DataTransferItem) {
  return item.kind === 'file' && item.type && SUPPORTED_IMAGE_CONTENT_TYPES.has(item.type);
}

const MiddleColumn: FC<StateProps> = ({
  chatId,
  threadId,
  messageListType,
  isPrivate,
  isPinnedMessageList,
  messageLists,
  canPost,
  currentUserBannedRights,
  defaultBannedRights,
  hasPinnedOrAudioPlayer,
  pinnedMessagesCount,
  customBackground,
  theme,
  backgroundColor,
  patternColor,
  isLeftColumnShown,
  isRightColumnShown,
  isBackgroundBlurred,
  isMobileSearchActive,
  isSelectModeActive,
  isPaymentModalOpen,
  isReceiptModalOpen,
  isSeenByModalOpen,
  isReactorListModalOpen,
  animationLevel,
  shouldSkipHistoryAnimations,
  currentTransitionKey,
  isChannel,
  canSubscribe,
  canStartBot,
  canRestartBot,
  activeEmojiInteractions,
}) => {
  const {
    openChat,
    unpinAllMessages,
    loadUser,
    closeLocalTextSearch,
    exitMessageSelectMode,
    closePaymentModal,
    clearReceipt,
    joinChannel,
    sendBotCommand,
    restartBot,
  } = getDispatch();

  const { width: windowWidth } = useWindowSize();

  const lang = useLang();
  const [dropAreaState, setDropAreaState] = useState(DropAreaState.None);
  const [isFabShown, setIsFabShown] = useState<boolean | undefined>();
  const [isNotchShown, setIsNotchShown] = useState<boolean | undefined>();
  const [isUnpinModalOpen, setIsUnpinModalOpen] = useState(false);

  const hasTools = hasPinnedOrAudioPlayer && (
    windowWidth < MOBILE_SCREEN_MAX_WIDTH
    || (
      isRightColumnShown && windowWidth > MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN
      && windowWidth < SAFE_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN
    ) || (
      windowWidth >= MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN
      && windowWidth < SAFE_SCREEN_WIDTH_FOR_CHAT_INFO
    )
  );

  const renderingChatId = usePrevDuringAnimation(chatId, CLOSE_ANIMATION_DURATION);
  const renderingThreadId = usePrevDuringAnimation(threadId, CLOSE_ANIMATION_DURATION);
  const renderingMessageListType = usePrevDuringAnimation(messageListType, CLOSE_ANIMATION_DURATION);
  const renderingCanSubscribe = usePrevDuringAnimation(canSubscribe, CLOSE_ANIMATION_DURATION);
  const renderingCanStartBot = usePrevDuringAnimation(canStartBot, CLOSE_ANIMATION_DURATION);
  const renderingCanRestartBot = usePrevDuringAnimation(canRestartBot, CLOSE_ANIMATION_DURATION);
  const renderingCanPost = usePrevDuringAnimation(canPost, CLOSE_ANIMATION_DURATION)
    && !renderingCanRestartBot && !renderingCanStartBot && !renderingCanSubscribe;
  const renderingHasTools = usePrevDuringAnimation(hasTools, CLOSE_ANIMATION_DURATION);
  const renderingIsFabShown = usePrevDuringAnimation(isFabShown, CLOSE_ANIMATION_DURATION);
  const renderingIsChannel = usePrevDuringAnimation(isChannel, CLOSE_ANIMATION_DURATION);

  const prevTransitionKey = usePrevious(currentTransitionKey);

  const cleanupExceptionKey = (
    prevTransitionKey !== undefined && prevTransitionKey < currentTransitionKey ? prevTransitionKey : undefined
  );

  const { isReady, handleOpenEnd, handleSlideStop } = useIsReady(
    !shouldSkipHistoryAnimations && animationLevel !== ANIMATION_LEVEL_MIN,
    currentTransitionKey,
    prevTransitionKey,
    chatId,
  );

  useEffect(() => {
    return chatId
      ? captureEscKeyListener(() => {
        openChat({ id: undefined });
      })
      : undefined;
  }, [chatId, openChat]);

  useOnChange(() => {
    setDropAreaState(DropAreaState.None);
    setIsFabShown(undefined);
    setIsNotchShown(undefined);
  }, [chatId]);

  // Fix for mobile virtual keyboard
  useEffect(() => {
    const { visualViewport } = window as any;
    if (!visualViewport) {
      return undefined;
    }

    const handleResize = () => {
      if (window.visualViewport.height !== document.documentElement.clientHeight) {
        document.body.classList.add('keyboard-visible');
      } else {
        document.body.classList.remove('keyboard-visible');
      }
    };

    visualViewport.addEventListener('resize', handleResize);

    return () => {
      visualViewport.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (isPrivate) {
      loadUser({ userId: chatId });
    }
  }, [chatId, isPrivate, loadUser]);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (IS_TOUCH_ENV) {
      return;
    }

    const { items } = e.dataTransfer || {};
    const shouldDrawQuick = items && items.length > 0 && Array.from(items)
      // Filter unnecessary element for drag and drop images in Firefox (https://github.com/Ajaxy/telegram-tt/issues/49)
      // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Recommended_drag_types#image
      .filter((item) => item.type !== 'text/uri-list')
      // As of September 2021, native clients suggest "send quick, but compressed" only for images
      .every(isImage);

    setDropAreaState(shouldDrawQuick ? DropAreaState.QuickFile : DropAreaState.Document);
  }, []);

  const handleHideDropArea = useCallback(() => {
    setDropAreaState(DropAreaState.None);
  }, []);

  const handleOpenUnpinModal = useCallback(() => {
    setIsUnpinModalOpen(true);
  }, []);

  const closeUnpinModal = useCallback(() => {
    setIsUnpinModalOpen(false);
  }, []);

  const handleUnpinAllMessages = useCallback(() => {
    unpinAllMessages({ chatId });
    closeUnpinModal();
    openChat({ id: chatId });
  }, [unpinAllMessages, openChat, closeUnpinModal, chatId]);

  const handleTabletFocus = useCallback(() => {
    openChat({ id: chatId });
  }, [openChat, chatId]);

  const handleSubscribeClick = useCallback(() => {
    joinChannel({ chatId });
  }, [joinChannel, chatId]);

  const handleStartBot = useCallback(() => {
    sendBotCommand({ command: '/start' });
  }, [sendBotCommand]);

  const handleRestartBot = useCallback(() => {
    restartBot({ chatId });
  }, [chatId, restartBot]);

  const customBackgroundValue = useCustomBackground(theme, customBackground);

  const className = buildClassName(
    renderingHasTools && 'has-header-tools',
    customBackground && 'custom-bg-image',
    backgroundColor && 'custom-bg-color',
    customBackground && isBackgroundBlurred && 'blurred',
    MASK_IMAGE_DISABLED ? 'mask-image-disabled' : 'mask-image-enabled',
  );

  const messagingDisabledClassName = buildClassName(
    'messaging-disabled',
    !isSelectModeActive && 'shown',
  );

  const messageSendingRestrictionReason = getMessageSendingRestrictionReason(
    lang, currentUserBannedRights, defaultBannedRights,
  );

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

  const closeChat = () => {
    openChat({ id: undefined }, { forceSyncOnIOs: true });
  };

  useHistoryBack(
    renderingChatId && renderingThreadId,
    closeChat, undefined, undefined, undefined,
    messageLists?.map(createMessageHash) || [],
  );

  useHistoryBack(isMobileSearchActive, closeLocalTextSearch);
  useHistoryBack(isSelectModeActive, exitMessageSelectMode);

  const isMessagingDisabled = Boolean(
    !isPinnedMessageList && !renderingCanPost && !renderingCanRestartBot && !renderingCanStartBot
    && !renderingCanSubscribe && messageSendingRestrictionReason,
  );
  const withMessageListBottomShift = Boolean(
    renderingCanRestartBot || renderingCanSubscribe || renderingCanStartBot || isPinnedMessageList,
  );
  const withExtraShift = Boolean(isMessagingDisabled || isSelectModeActive || isPinnedMessageList);

  return (
    <div
      id="MiddleColumn"
      className={className}
      onTransitionEnd={handleOpenEnd}
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
      onClick={(IS_TABLET_COLUMN_LAYOUT && isLeftColumnShown) ? handleTabletFocus : undefined}
    >
      <div
        id="middle-column-bg"
        style={customBackgroundValue ? `--custom-background: ${customBackgroundValue}` : undefined}
      />
      <div id="middle-column-portals" />
      {renderingChatId && renderingThreadId && (
        <>
          <div className="messages-layout" onDragEnter={renderingCanPost ? handleDragEnter : undefined}>
            <MiddleHeader
              chatId={renderingChatId}
              threadId={renderingThreadId}
              messageListType={renderingMessageListType}
              isReady={isReady}
            />
            <Transition
              name={shouldSkipHistoryAnimations ? 'none' : animationLevel === ANIMATION_LEVEL_MAX ? 'slide' : 'fade'}
              activeKey={currentTransitionKey}
              shouldCleanup
              cleanupExceptionKey={cleanupExceptionKey}
              onStop={handleSlideStop}
            >
              <MessageList
                key={`${renderingChatId}-${renderingThreadId}-${renderingMessageListType}`}
                chatId={renderingChatId}
                threadId={renderingThreadId}
                type={renderingMessageListType}
                canPost={renderingCanPost}
                hasTools={renderingHasTools}
                onFabToggle={setIsFabShown}
                onNotchToggle={setIsNotchShown}
                isReady={isReady}
                withBottomShift={withMessageListBottomShift}
              />
              <div className={footerClassName}>
                {renderingCanPost && (
                  <Composer
                    chatId={renderingChatId}
                    threadId={renderingThreadId}
                    messageListType={renderingMessageListType}
                    dropAreaState={dropAreaState}
                    onDropHide={handleHideDropArea}
                    isReady={isReady}
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
                      <i className="icon-unpin" />
                      <span>{lang('Chat.Pinned.UnpinAll', pinnedMessagesCount, 'i')}</span>
                    </Button>
                  </div>
                )}
                {isMessagingDisabled && (
                  <div className={messagingDisabledClassName}>
                    <div className="messaging-disabled-inner">
                      <span>
                        {messageSendingRestrictionReason}
                      </span>
                    </div>
                  </div>
                )}
                {IS_SINGLE_COLUMN_LAYOUT && renderingCanSubscribe && (
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
                {IS_SINGLE_COLUMN_LAYOUT && renderingCanStartBot && (
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
                {IS_SINGLE_COLUMN_LAYOUT && renderingCanRestartBot && (
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
                <PaymentModal
                  isOpen={Boolean(isPaymentModalOpen)}
                  onClose={closePaymentModal}
                />
                <ReceiptModal
                  isOpen={Boolean(isReceiptModalOpen)}
                  onClose={clearReceipt}
                />
                <SeenByModal isOpen={isSeenByModalOpen} />
                <ReactorListModal isOpen={isReactorListModalOpen} />
              </div>
            </Transition>

            <ScrollDownButton
              isShown={renderingIsFabShown}
              canPost={renderingCanPost}
              withExtraShift={withExtraShift}
            />
          </div>
          {IS_SINGLE_COLUMN_LAYOUT && <MobileSearch isActive={Boolean(isMobileSearchActive)} />}
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
};

export default memo(withGlobal(
  (global): StateProps => {
    const theme = selectTheme(global);
    const {
      isBlurred: isBackgroundBlurred, background: customBackground, backgroundColor, patternColor,
    } = global.settings.themes[theme] || {};

    const { messageLists } = global.messages;
    const currentMessageList = selectCurrentMessageList(global);
    const { isLeftColumnShown, chats: { listIds }, activeEmojiInteractions } = global;

    const state: StateProps = {
      theme,
      customBackground,
      backgroundColor,
      patternColor,
      isLeftColumnShown,
      isRightColumnShown: selectIsRightColumnShown(global),
      isBackgroundBlurred,
      isMobileSearchActive: Boolean(IS_SINGLE_COLUMN_LAYOUT && selectCurrentTextSearch(global)),
      isSelectModeActive: selectIsInSelectMode(global),
      isPaymentModalOpen: global.payment.isPaymentModalOpen,
      isReceiptModalOpen: Boolean(global.payment.receipt),
      isSeenByModalOpen: Boolean(global.seenByModal),
      isReactorListModalOpen: Boolean(global.reactorModal),
      animationLevel: global.settings.byKey.animationLevel,
      currentTransitionKey: Math.max(0, global.messages.messageLists.length - 1),
      activeEmojiInteractions,
    };

    if (!currentMessageList || !listIds.active) {
      return state;
    }

    const { chatId, threadId, type: messageListType } = currentMessageList;
    const chat = selectChat(global, chatId);
    const bot = selectChatBot(global, chatId);
    const pinnedIds = selectPinnedIds(global, chatId);
    const { chatId: audioChatId, messageId: audioMessageId } = global.audioPlayer;

    const canPost = chat && getCanPostInChat(chat, threadId);
    const isBotNotStarted = selectIsChatBotNotStarted(global, chatId);
    const isPinnedMessageList = messageListType === 'pinned';
    const isScheduledMessageList = messageListType === 'scheduled';
    const isMainThread = messageListType === 'thread' && threadId === MAIN_THREAD_ID;
    const isChannel = Boolean(chat && isChatChannel(chat));
    const canSubscribe = Boolean(
      chat && isMainThread && (isChannel || isChatSuperGroup(chat)) && chat.isNotJoined,
    );
    const canRestartBot = Boolean(bot && selectIsUserBlocked(global, bot.id));
    const canStartBot = !canRestartBot && isBotNotStarted;

    return {
      ...state,
      chatId,
      threadId,
      messageListType,
      isPrivate: isUserId(chatId),
      canPost: !isPinnedMessageList && (!chat || canPost) && !isBotNotStarted,
      isPinnedMessageList,
      isScheduledMessageList,
      currentUserBannedRights: chat?.currentUserBannedRights,
      defaultBannedRights: chat?.defaultBannedRights,
      hasPinnedOrAudioPlayer: (
        threadId !== MAIN_THREAD_ID
        || Boolean(!isPinnedMessageList && pinnedIds?.length)
        || Boolean(audioChatId && audioMessageId)
      ),
      pinnedMessagesCount: pinnedIds ? pinnedIds.length : 0,
      shouldSkipHistoryAnimations: global.shouldSkipHistoryAnimations,
      messageLists,
      isChannel,
      canSubscribe,
      canStartBot,
      canRestartBot,
    };
  },
)(MiddleColumn));

function useIsReady(
  withAnimations?: boolean,
  currentTransitionKey?: number,
  prevTransitionKey?: number,
  chatId?: string,
) {
  const [isReady, setIsReady] = useState(!IS_SINGLE_COLUMN_LAYOUT);
  const forceUpdate = useForceUpdate();

  const willSwitchMessageList = prevTransitionKey !== undefined && prevTransitionKey !== currentTransitionKey;
  if (willSwitchMessageList) {
    if (withAnimations) {
      setIsReady(false);
    } else {
      forceUpdate();
    }
  }

  useOnChange(() => {
    if (!withAnimations) {
      setIsReady(true);
    }
  }, [withAnimations]);

  function handleOpenEnd(e: React.TransitionEvent<HTMLDivElement>) {
    if (e.propertyName === 'transform' && e.target === e.currentTarget) {
      setIsReady(Boolean(chatId));
    }
  }

  function handleSlideStop() {
    setIsReady(true);
  }

  return {
    isReady: isReady && !willSwitchMessageList,
    handleOpenEnd: withAnimations ? handleOpenEnd : undefined,
    handleSlideStop: withAnimations ? handleSlideStop : undefined,
  };
}
