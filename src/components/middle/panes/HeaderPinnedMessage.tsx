import React, { memo, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiMessage, ApiPeer } from '../../../api/types';
import type { MessageListType, ThreadId } from '../../../types';
import type { Signal } from '../../../util/signals';
import { MAIN_THREAD_ID } from '../../../api/types';

import {
  getIsSavedDialog,
  getMessageIsSpoiler,
  getMessageMediaHash,
  getMessageSingleInlineButton,
  getMessageVideo,
  getPeerTitle,
} from '../../../global/helpers';
import {
  selectAllowedMessageActionsSlow,
  selectChat,
  selectChatMessage,
  selectChatMessages,
  selectForwardedSender,
  selectPinnedIds,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import cycleRestrict from '../../../util/cycleRestrict';
import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';
import { getPictogramDimensions, REM } from '../../common/helpers/mediaDimensions';
import renderText from '../../common/helpers/renderText';
import renderKeyboardButtonText from '../composer/helpers/renderKeyboardButtonText';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useDerivedState from '../../../hooks/useDerivedState';
import useEnsureMessage from '../../../hooks/useEnsureMessage';
import { useFastClick } from '../../../hooks/useFastClick';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useShowTransition from '../../../hooks/useShowTransition';
import useThumbnail from '../../../hooks/useThumbnail';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';
import useHeaderPane, { type PaneState } from '../hooks/useHeaderPane';

import AnimatedCounter from '../../common/AnimatedCounter';
import Icon from '../../common/icons/Icon';
import MediaSpoiler from '../../common/MediaSpoiler';
import MessageSummary from '../../common/MessageSummary';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import RippleEffect from '../../ui/RippleEffect';
import Spinner from '../../ui/Spinner';
import Transition from '../../ui/Transition';
import PinnedMessageNavigation from '../PinnedMessageNavigation';

import styles from './HeaderPinnedMessage.module.scss';

const MAX_LENGTH = 256;
const SHOW_LOADER_DELAY = 450;
const EMOJI_SIZE = 1.125 * REM;

type OwnProps = {
  chatId: string;
  threadId: ThreadId;
  // eslint-disable-next-line react/no-unused-prop-types
  messageListType: MessageListType;
  className?: string;
  isFullWidth?: boolean;
  shouldHide?: boolean;
  getLoadingPinnedId: Signal<number | undefined>;
  getCurrentPinnedIndex: Signal<number>;
  onFocusPinnedMessage: (messageId: number) => void;
  onPaneStateChange?: (state: PaneState) => void;
};

type StateProps = {
  chat?: ApiChat;
  pinnedMessageIds?: number[] | number;
  messagesById?: Record<number, ApiMessage>;
  canUnpin?: boolean;
  topMessageSender?: ApiPeer;
  isSynced?: boolean;
};

const HeaderPinnedMessage = ({
  chatId,
  threadId,
  canUnpin,
  getLoadingPinnedId,
  pinnedMessageIds,
  messagesById,
  isFullWidth,
  topMessageSender,
  getCurrentPinnedIndex,
  className,
  chat,
  isSynced,
  shouldHide,
  onPaneStateChange,
  onFocusPinnedMessage,
}: OwnProps & StateProps) => {
  const {
    clickBotInlineButton, focusMessage, openThread, pinMessage, loadPinnedMessages,
  } = getActions();
  const lang = useLang();

  const currentPinnedIndex = useDerivedState(getCurrentPinnedIndex);
  const pinnedMessageId = Array.isArray(pinnedMessageIds) ? pinnedMessageIds[currentPinnedIndex] : pinnedMessageIds;
  const pinnedMessage = messagesById && pinnedMessageId ? messagesById[pinnedMessageId] : undefined;
  const pinnedMessagesCount = Array.isArray(pinnedMessageIds)
    ? pinnedMessageIds.length : (pinnedMessageIds ? 1 : 0);
  const pinnedMessageNumber = Math.max(pinnedMessagesCount - currentPinnedIndex, 1);

  const topMessageTitle = topMessageSender ? getPeerTitle(lang, topMessageSender) : undefined;

  const video = pinnedMessage && getMessageVideo(pinnedMessage);
  const gif = video?.isGif ? video : undefined;
  const isVideoThumbnail = Boolean(gif && !gif.previewPhotoSizes?.length);

  const mediaThumbnail = useThumbnail(pinnedMessage);
  const mediaHash = pinnedMessage && getMessageMediaHash(pinnedMessage, isVideoThumbnail ? 'full' : 'pictogram');
  const mediaBlobUrl = useMedia(mediaHash);
  const isSpoiler = pinnedMessage && getMessageIsSpoiler(pinnedMessage);

  const isLoading = Boolean(useDerivedState(getLoadingPinnedId));
  const canRenderLoader = useAsyncRendering([isLoading], SHOW_LOADER_DELAY);
  const shouldShowLoader = canRenderLoader && isLoading;

  const renderingPinnedMessage = useCurrentOrPrev(pinnedMessage, true);

  useEffect(() => {
    if (isSynced && (threadId === MAIN_THREAD_ID || chat?.isForum)) {
      loadPinnedMessages({ chatId, threadId });
    }
  }, [chatId, threadId, isSynced, chat?.isForum]);

  useEnsureMessage(chatId, pinnedMessageId, pinnedMessage);

  const isOpen = Boolean(pinnedMessage) && !shouldHide;
  const {
    ref: transitionRef,
  } = useShowTransition({
    isOpen,
    noOpenTransition: true,
    shouldForceOpen: isFullWidth, // Use pane animation instead
  });

  const { ref, shouldRender } = useHeaderPane({
    isOpen,
    isDisabled: !isFullWidth,
    ref: transitionRef,
    onStateChange: onPaneStateChange,
  });

  const [isUnpinDialogOpen, openUnpinDialog, closeUnpinDialog] = useFlag();

  const handleUnpinMessage = useLastCallback(() => {
    closeUnpinDialog();
    pinMessage({ chatId, messageId: pinnedMessage!.id, isUnpin: true });
  });

  const inlineButton = pinnedMessage && getMessageSingleInlineButton(pinnedMessage);

  const handleInlineButtonClick = useLastCallback(() => {
    if (inlineButton) {
      clickBotInlineButton({ chatId: pinnedMessage.chatId, messageId: pinnedMessage.id, button: inlineButton });
    }
  });

  const handleAllPinnedClick = useLastCallback(() => {
    openThread({ chatId, threadId, type: 'pinned' });
  });

  const handleMessageClick = useLastCallback((e: React.MouseEvent<HTMLElement, MouseEvent>): void => {
    const nextMessageId = e.shiftKey && Array.isArray(pinnedMessageIds)
      ? pinnedMessageIds[cycleRestrict(pinnedMessageIds.length, pinnedMessageIds.indexOf(pinnedMessageId!) - 2)]
      : pinnedMessageId!;

    if (!getLoadingPinnedId()) {
      focusMessage({
        chatId, threadId, messageId: nextMessageId, noForumTopicPanel: true,
      });
      onFocusPinnedMessage(nextMessageId);
    }
  });

  const [noHoverColor, markNoHoverColor, unmarkNoHoverColor] = useFlag();

  const { handleClick, handleMouseDown } = useFastClick(handleMessageClick);

  function renderPictogram(thumbDataUri?: string, blobUrl?: string, isFullVideo?: boolean, asSpoiler?: boolean) {
    const { width, height } = getPictogramDimensions();
    const srcUrl = blobUrl || thumbDataUri;
    const shouldRenderVideo = isFullVideo && blobUrl;

    return (
      <div className={styles.pinnedThumb}>
        {thumbDataUri && !asSpoiler && !shouldRenderVideo && (
          <img
            className={styles.pinnedThumbImage}
            src={srcUrl}
            width={width}
            height={height}
            alt=""
            draggable={false}
          />
        )}
        {shouldRenderVideo && !asSpoiler && (
          <video
            src={blobUrl}
            width={width}
            height={height}
            playsInline
            disablePictureInPicture
            className={styles.pinnedThumbImage}
          />
        )}
        {thumbDataUri
          && <MediaSpoiler thumbDataUri={srcUrl} isVisible={Boolean(asSpoiler)} width={width} height={height} />}
      </div>
    );
  }

  if (!shouldRender || !renderingPinnedMessage) return undefined;

  return (
    <div
      ref={ref}
      className={buildClassName(
        'HeaderPinnedMessageWrapper', styles.root, isFullWidth ? styles.fullWidth : styles.mini, className,
      )}
    >
      {(pinnedMessagesCount > 1 || shouldShowLoader) && (
        <Button
          round
          size="smaller"
          color="translucent"
          ariaLabel={lang('EventLogFilterPinnedMessages')}
          onClick={!shouldShowLoader ? handleAllPinnedClick : undefined}
        >
          {isLoading && (
            <Spinner
              color="blue"
              className={buildClassName(
                styles.loading, styles.pinListIcon, !shouldShowLoader && styles.pinListIconHidden,
              )}
            />
          )}
          <Icon
            name="pin-list"
            className={buildClassName(
              styles.pinListIcon, shouldShowLoader && styles.pinListIconHidden,
            )}
          />
        </Button>
      )}
      {canUnpin && (
        <Button
          round
          size="smaller"
          color="translucent"
          ariaLabel={lang('UnpinMessageAlertTitle')}
          onClick={openUnpinDialog}
        >
          <Icon name="close" />
        </Button>
      )}
      <ConfirmDialog
        isOpen={isUnpinDialogOpen}
        onClose={closeUnpinDialog}
        text={lang('PinnedConfirmUnpin')}
        confirmLabel={lang('DialogUnpin')}
        confirmHandler={handleUnpinMessage}
      />
      <div
        className={buildClassName(styles.pinnedMessage, noHoverColor && styles.noHover)}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        dir={lang.isRtl ? 'rtl' : undefined}
      >
        <PinnedMessageNavigation
          count={pinnedMessagesCount}
          index={currentPinnedIndex}
        />
        <Transition activeKey={renderingPinnedMessage.id} name="slideVertical" className={styles.pictogramTransition}>
          {renderPictogram(
            mediaThumbnail,
            mediaBlobUrl,
            isVideoThumbnail,
            isSpoiler,
          )}
        </Transition>
        <div
          className={buildClassName(styles.messageText, mediaThumbnail && styles.withMedia)}
          dir={lang.isRtl ? 'rtl' : undefined}
        >
          <div className={styles.title} dir={lang.isRtl ? 'rtl' : undefined}>
            {!topMessageTitle && (
              <AnimatedCounter
                text={pinnedMessagesCount === 1
                  ? lang('PinnedMessageTitleSingle')
                  : lang('PinnedMessageTitle', { index: pinnedMessageNumber }, { pluralValue: pinnedMessagesCount })}
              />
            )}

            {topMessageTitle && renderText(topMessageTitle)}
          </div>
          <Transition
            activeKey={renderingPinnedMessage.id}
            name="slideVerticalFade"
            className={styles.messageTextTransition}
          >
            <p dir="auto" className={styles.summary}>
              <MessageSummary
                message={renderingPinnedMessage}
                truncateLength={MAX_LENGTH}
                noEmoji={Boolean(mediaThumbnail)}
                emojiSize={EMOJI_SIZE}
              />
            </p>
          </Transition>
        </div>
        <RippleEffect />
        {inlineButton && (
          <Button
            size="tiny"
            className={styles.inlineButton}
            onClick={handleInlineButtonClick}
            shouldStopPropagation
            onMouseEnter={!IS_TOUCH_ENV ? markNoHoverColor : undefined}
            onMouseLeave={!IS_TOUCH_ENV ? unmarkNoHoverColor : undefined}
          >
            {renderKeyboardButtonText(lang, inlineButton)}
          </Button>
        )}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, {
    chatId, threadId, messageListType,
  }): StateProps => {
    const chat = selectChat(global, chatId);

    const isSynced = global.isSynced;
    const isSavedDialog = getIsSavedDialog(chatId, threadId, global.currentUserId);

    const messagesById = selectChatMessages(global, chatId);

    const state = {
      chat,
      isSynced,
    };

    if (messageListType !== 'thread' || !messagesById) {
      return state;
    }

    if (threadId !== MAIN_THREAD_ID && !isSavedDialog && !chat?.isForum) {
      const pinnedMessageId = Number(threadId);
      const message = pinnedMessageId ? selectChatMessage(global, chatId, pinnedMessageId) : undefined;
      const topMessageSender = message ? selectForwardedSender(global, message) : undefined;

      return {
        ...state,
        pinnedMessageIds: pinnedMessageId,
        messagesById,
        canUnpin: false,
        topMessageSender,
      };
    }

    const pinnedMessageIds = !isSavedDialog ? selectPinnedIds(global, chatId, threadId) : undefined;
    if (pinnedMessageIds?.length) {
      const firstPinnedMessage = messagesById[pinnedMessageIds[0]];
      const {
        canUnpin = false,
      } = (
        firstPinnedMessage
        && pinnedMessageIds.length === 1
        && selectAllowedMessageActionsSlow(global, firstPinnedMessage, threadId)
      ) || {};

      return {
        ...state,
        pinnedMessageIds,
        messagesById,
        canUnpin,
      };
    }

    return state;
  },
)(HeaderPinnedMessage));
