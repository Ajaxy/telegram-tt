import React, {
  FC, useEffect, useState, memo, useMemo, useCallback,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { ApiChatBannedRights, MAIN_THREAD_ID } from '../../api/types';
import { GlobalActions, MessageListType, MessageList as GlobalMessageList } from '../../global/types';
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
  selectCurrentMessageList,
  selectCurrentTextSearch,
  selectIsChatBotNotStarted,
  selectIsInSelectMode,
  selectIsRightColumnShown,
  selectPinnedIds,
  selectTheme,
} from '../../modules/selectors';
import { getCanPostInChat, getMessageSendingRestrictionReason, isUserId } from '../../modules/helpers';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { pick } from '../../util/iteratees';
import buildClassName from '../../util/buildClassName';
import useCustomBackground from '../../hooks/useCustomBackground';
import useWindowSize from '../../hooks/useWindowSize';
import usePrevDuringAnimation from '../../hooks/usePrevDuringAnimation';
import calculateMiddleFooterTransforms from './helpers/calculateMiddleFooterTransforms';
import useLang from '../../hooks/useLang';
import useHistoryBack from '../../hooks/useHistoryBack';
import { createMessageHash } from '../../util/routing';

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
  hasPinnedOrAudioMessage?: boolean;
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
  animationLevel?: number;
  shouldSkipHistoryAnimations?: boolean;
  currentTransitionKey: number;
  messageLists?: GlobalMessageList[];
};

type DispatchProps = Pick<GlobalActions, (
  'openChat' | 'unpinAllMessages' | 'loadUser' | 'closeLocalTextSearch' | 'exitMessageSelectMode' |
  'closePaymentModal' | 'clearReceipt'
)>;

const CLOSE_ANIMATION_DURATION = IS_SINGLE_COLUMN_LAYOUT ? 450 + ANIMATION_END_DELAY : undefined;

function isImage(item: DataTransferItem) {
  return item.kind === 'file' && item.type && SUPPORTED_IMAGE_CONTENT_TYPES.has(item.type);
}

const MiddleColumn: FC<StateProps & DispatchProps> = ({
  chatId,
  threadId,
  messageListType,
  isPrivate,
  isPinnedMessageList,
  messageLists,
  canPost,
  currentUserBannedRights,
  defaultBannedRights,
  hasPinnedOrAudioMessage,
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
  animationLevel,
  shouldSkipHistoryAnimations,
  currentTransitionKey,
  openChat,
  unpinAllMessages,
  loadUser,
  closeLocalTextSearch,
  exitMessageSelectMode,
  closePaymentModal,
  clearReceipt,
}) => {
  const { width: windowWidth } = useWindowSize();

  const lang = useLang();
  const [dropAreaState, setDropAreaState] = useState(DropAreaState.None);
  const [isFabShown, setIsFabShown] = useState<boolean | undefined>();
  const [isNotchShown, setIsNotchShown] = useState<boolean | undefined>();
  const [isUnpinModalOpen, setIsUnpinModalOpen] = useState(false);
  const [isReady, setIsReady] = useState(!IS_SINGLE_COLUMN_LAYOUT || animationLevel === ANIMATION_LEVEL_MIN);

  const hasTools = hasPinnedOrAudioMessage && (
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
  const renderingCanPost = usePrevDuringAnimation(canPost, CLOSE_ANIMATION_DURATION);
  const renderingHasTools = usePrevDuringAnimation(hasTools, CLOSE_ANIMATION_DURATION);
  const renderingIsFabShown = usePrevDuringAnimation(isFabShown, CLOSE_ANIMATION_DURATION);

  useEffect(() => {
    return chatId
      ? captureEscKeyListener(() => {
        openChat({ id: undefined });
      })
      : undefined;
  }, [chatId, openChat]);

  useEffect(() => {
    setDropAreaState(DropAreaState.None);
    setIsFabShown(undefined);
    setIsNotchShown(undefined);
  }, [chatId]);

  useEffect(() => {
    if (animationLevel === ANIMATION_LEVEL_MIN) {
      setIsReady(true);
    }
  }, [animationLevel]);

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

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName === 'transform' && e.target === e.currentTarget) {
      setIsReady(Boolean(chatId));
    }
  };

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
    const shouldDrawQuick = items && Array.from(items)
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
    openChat({ id: undefined }, true);
  };

  useHistoryBack(renderingChatId && renderingThreadId,
    closeChat, undefined, undefined, undefined,
    messageLists ? messageLists.map(createMessageHash) : []);

  useHistoryBack(isMobileSearchActive, closeLocalTextSearch);
  useHistoryBack(isSelectModeActive, exitMessageSelectMode);

  const isMessagingDisabled = Boolean(!isPinnedMessageList && !renderingCanPost && messageSendingRestrictionReason);

  return (
    <div
      id="MiddleColumn"
      className={className}
      onTransitionEnd={handleTransitionEnd}
      // @ts-ignore teact-feature
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
        // @ts-ignore
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
            >
              {(isActive) => (
                <>
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
                    isActive={isActive}
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
                      <div className="unpin-button-container" dir={lang.isRtl ? 'rtl' : undefined}>
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
                  </div>
                </>
              )}
            </Transition>

            <ScrollDownButton
              isShown={renderingIsFabShown}
              canPost={renderingCanPost}
              withExtraShift={isMessagingDisabled || isSelectModeActive || isPinnedMessageList}
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
    const { isLeftColumnShown, chats: { listIds } } = global;

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
      animationLevel: global.settings.byKey.animationLevel,
      currentTransitionKey: Math.max(0, global.messages.messageLists.length - 1),
    };

    if (!currentMessageList || !listIds.active) {
      return state;
    }

    const { chatId, threadId, type: messageListType } = currentMessageList;
    const chat = selectChat(global, chatId);
    const pinnedIds = selectPinnedIds(global, chatId);
    const { chatId: audioChatId, messageId: audioMessageId } = global.audioPlayer;

    const canPost = chat && getCanPostInChat(chat, threadId);
    const isBotNotStarted = selectIsChatBotNotStarted(global, chatId);
    const isPinnedMessageList = messageListType === 'pinned';
    const isScheduledMessageList = messageListType === 'scheduled';

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
      hasPinnedOrAudioMessage: (
        threadId !== MAIN_THREAD_ID
        || Boolean(pinnedIds?.length)
        || Boolean(audioChatId && audioMessageId)
      ),
      pinnedMessagesCount: pinnedIds ? pinnedIds.length : 0,
      shouldSkipHistoryAnimations: global.shouldSkipHistoryAnimations,
      messageLists,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'openChat', 'unpinAllMessages', 'loadUser', 'closeLocalTextSearch', 'exitMessageSelectMode',
    'closePaymentModal', 'clearReceipt',
  ]),
)(MiddleColumn));
