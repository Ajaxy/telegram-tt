import React, {
  FC, useEffect, useState, memo, useMemo, useCallback,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { MAIN_THREAD_ID } from '../../api/types';
import { GlobalActions, MessageListType } from '../../global/types';

import {
  MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN,
  MOBILE_SCREEN_MAX_WIDTH,
  MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN,
  SAFE_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN,
  SAFE_SCREEN_WIDTH_FOR_CHAT_INFO,
  CONTENT_TYPES_FOR_QUICK_UPLOAD,
  ANIMATION_LEVEL_MAX,
  ANIMATION_END_DELAY,
} from '../../config';
import { IS_MOBILE_SCREEN, IS_TOUCH_ENV, MASK_IMAGE_DISABLED } from '../../util/environment';
import { DropAreaState } from './composer/DropArea';
import {
  selectChat,
  selectCurrentMessageList,
  selectCurrentTextSearch,
  selectIsChatBotNotStarted,
  selectIsInSelectMode,
  selectIsRightColumnShown,
  selectPinnedIds,
} from '../../modules/selectors';
import { getCanPostInChat, getMessageSendingRestrictionReason, isChatPrivate } from '../../modules/helpers';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { pick } from '../../util/iteratees';
import buildClassName from '../../util/buildClassName';
import useCustomBackground from '../../hooks/useCustomBackground';
import useWindowSize from '../../hooks/useWindowSize';
import usePrevDuringAnimation from '../../hooks/usePrevDuringAnimation';
import calculateMiddleFooterTransforms from './helpers/calculateMiddleFooterTransforms';
import useLang from '../../hooks/useLang';

import Transition from '../ui/Transition';
import MiddleHeader from './MiddleHeader';
import MessageList from './MessageList';
import ScrollDownButton from './ScrollDownButton';
import Composer from './composer/Composer';
import Button from '../ui/Button';
import MobileSearch from './MobileSearch.async';
import MessageSelectToolbar from './MessageSelectToolbar.async';
import UnpinAllMessagesModal from '../common/UnpinAllMessagesModal.async';

import './MiddleColumn.scss';

type StateProps = {
  chatId?: number;
  threadId?: number;
  messageListType?: MessageListType;
  isPrivate?: boolean;
  isPinnedMessageList?: boolean;
  canPost?: boolean;
  messageSendingRestrictionReason?: string;
  hasPinnedOrAudioMessage?: boolean;
  pinnedMessagesCount?: number;
  customBackground?: string;
  patternColor?: string;
  isCustomBackgroundColor?: boolean;
  isRightColumnShown?: boolean;
  isBackgroundBlurred?: boolean;
  isMobileSearchActive?: boolean;
  isSelectModeActive?: boolean;
  animationLevel?: number;
};

type DispatchProps = Pick<GlobalActions, 'openChat' | 'unpinAllMessages' | 'loadUser'>;

const CLOSE_ANIMATION_DURATION = IS_MOBILE_SCREEN ? 450 + ANIMATION_END_DELAY : undefined;

function canBeQuicklyUploaded(item: DataTransferItem) {
  return item.kind === 'file' && item.type && CONTENT_TYPES_FOR_QUICK_UPLOAD.includes(item.type);
}

const MiddleColumn: FC<StateProps & DispatchProps> = ({
  chatId,
  threadId,
  messageListType,
  isPrivate,
  isPinnedMessageList,
  canPost,
  messageSendingRestrictionReason,
  hasPinnedOrAudioMessage,
  pinnedMessagesCount,
  customBackground,
  patternColor,
  isCustomBackgroundColor,
  isRightColumnShown,
  isBackgroundBlurred,
  isMobileSearchActive,
  isSelectModeActive,
  animationLevel,
  openChat,
  unpinAllMessages,
  loadUser,
}) => {
  const { width: windowWidth } = useWindowSize();

  const [dropAreaState, setDropAreaState] = useState(DropAreaState.None);
  const [isFabShown, setIsFabShown] = useState<boolean | undefined>();
  const [isUnpinModalOpen, setIsUnpinModalOpen] = useState(false);

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
  }, [chatId]);

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
    const shouldDrawQuick = items && Array.from(items).every(canBeQuicklyUploaded);

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

  const customBackgroundValue = useCustomBackground(customBackground);

  const className = buildClassName(
    renderingHasTools && 'has-header-tools',
    customBackground && !isCustomBackgroundColor && 'custom-bg-image',
    customBackground && isCustomBackgroundColor && 'custom-bg-color',
    customBackground && isBackgroundBlurred && 'blurred',
    MASK_IMAGE_DISABLED ? 'mask-image-disabled' : 'mask-image-enabled',
  );

  const messagingDisabledClassName = buildClassName(
    'messaging-disabled',
    !isSelectModeActive && 'shown',
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

  const lang = useLang();

  return (
    <div
      id="MiddleColumn"
      className={className}
      // @ts-ignore teact-feature
      style={`
        --composer-hidden-scale: ${composerHiddenScale};
        --toolbar-hidden-scale: ${toolbarHiddenScale};
        --unpin-hidden-scale: ${unpinHiddenScale};
        --toolbar-unpin-hidden-scale: ${toolbarForUnpinHiddenScale};
        --composer-translate-x: ${composerTranslateX}px;
        --toolbar-translate-x: ${toolbarTranslateX}px;
        --pattern-color: ${patternColor};
      `}
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
            />
            <Transition
              name={animationLevel === ANIMATION_LEVEL_MAX ? 'slide' : 'fade'}
              activeKey={renderingMessageListType === 'thread' && renderingThreadId === MAIN_THREAD_ID ? 1 : 2}
              shouldCleanup
            >
              {() => (
                <>
                  <MessageList
                    key={`${renderingChatId}-${renderingThreadId}-${renderingMessageListType}`}
                    chatId={renderingChatId}
                    threadId={renderingThreadId}
                    type={renderingMessageListType}
                    canPost={renderingCanPost}
                    hasTools={renderingHasTools}
                    onFabToggle={setIsFabShown}
                  />
                  <div className={buildClassName('middle-column-footer', !renderingCanPost && 'no-composer')}>
                    {renderingCanPost && (
                      <Composer
                        chatId={renderingChatId}
                        threadId={renderingThreadId}
                        messageListType={renderingMessageListType}
                        dropAreaState={dropAreaState}
                        onDropHide={handleHideDropArea}
                      />
                    )}
                    {isPinnedMessageList && (
                      <div className="unpin-button-container">
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
                    {!isPinnedMessageList && !renderingCanPost && messageSendingRestrictionReason && (
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
                  </div>
                </>
              )}
            </Transition>

            <ScrollDownButton
              isShown={renderingIsFabShown}
              canPost={renderingCanPost}
            />
          </div>
          {IS_MOBILE_SCREEN && <MobileSearch isActive={Boolean(isMobileSearchActive)} />}
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
    const { isBackgroundBlurred, customBackground, patternColor } = global.settings.byKey;

    const isCustomBackgroundColor = Boolean((customBackground || '').match(/^#[a-f\d]{6,8}$/i));
    const currentMessageList = selectCurrentMessageList(global);
    const { chats: { listIds } } = global;

    const state: StateProps = {
      customBackground,
      patternColor,
      isCustomBackgroundColor,
      isRightColumnShown: selectIsRightColumnShown(global),
      isBackgroundBlurred,
      isMobileSearchActive: Boolean(IS_MOBILE_SCREEN && selectCurrentTextSearch(global)),
      isSelectModeActive: selectIsInSelectMode(global),
      animationLevel: global.settings.byKey.animationLevel,
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

    return {
      ...state,
      chatId,
      threadId,
      messageListType,
      isPrivate: isChatPrivate(chatId),
      canPost: !isPinnedMessageList && (!chat || canPost) && (!isBotNotStarted || IS_MOBILE_SCREEN),
      isPinnedMessageList,
      messageSendingRestrictionReason: chat && getMessageSendingRestrictionReason(chat),
      hasPinnedOrAudioMessage: (
        threadId !== MAIN_THREAD_ID
        || Boolean(pinnedIds && pinnedIds.length)
        || Boolean(audioChatId && audioMessageId)
      ),
      pinnedMessagesCount: pinnedIds ? pinnedIds.length : 0,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'openChat', 'unpinAllMessages', 'loadUser',
  ]),
)(MiddleColumn));
