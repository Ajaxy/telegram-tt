import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type {
  ApiChat, ApiMessage, ApiSticker, ApiTopic, ApiUser,
} from '../../api/types';
import type { MessageListType } from '../../global/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { FocusDirection, ThreadId } from '../../types';
import type { PinnedIntersectionChangedCallback } from './hooks/usePinnedMessage';

import {
  getChatTitle, getMessageHtmlId, isChatChannel, isJoinedChannelMessage,
} from '../../global/helpers';
import { getMessageReplyInfo } from '../../global/helpers/replies';
import {
  selectCanPlayAnimatedEmojis,
  selectChat,
  selectChatMessage,
  selectGiftStickerForDuration,
  selectIsMessageFocused,
  selectTabState,
  selectTopicFromMessage,
  selectUser,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { renderActionMessageText } from '../common/helpers/renderActionMessageText';
import renderText from '../common/helpers/renderText';
import { preventMessageInputBlur } from './helpers/preventMessageInputBlur';

import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useEnsureMessage from '../../hooks/useEnsureMessage';
import useFlag from '../../hooks/useFlag';
import { useIsIntersecting, useOnIntersect } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';
import useShowTransition from '../../hooks/useShowTransition';
import useFocusMessage from './message/hooks/useFocusMessage';

import AnimatedIconFromSticker from '../common/AnimatedIconFromSticker';
import ActionMessageSuggestedAvatar from './ActionMessageSuggestedAvatar';
import ContextMenuContainer from './message/ContextMenuContainer.async';
import SimilarChannels from './message/SimilarChannels';

type OwnProps = {
  message: ApiMessage;
  threadId?: ThreadId;
  messageListType?: MessageListType;
  observeIntersectionForReading?: ObserveFn;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  isEmbedded?: boolean;
  appearanceOrder?: number;
  isJustAdded?: boolean;
  isLastInList?: boolean;
  isInsideTopic?: boolean;
  memoFirstUnreadIdRef?: { current: number | undefined };
  onPinnedIntersectionChange?: PinnedIntersectionChangedCallback;
};

type StateProps = {
  senderUser?: ApiUser;
  senderChat?: ApiChat;
  targetUserIds?: string[];
  targetMessage?: ApiMessage;
  targetChatId?: string;
  targetChat?: ApiChat;
  isFocused: boolean;
  topic?: ApiTopic;
  focusDirection?: FocusDirection;
  noFocusHighlight?: boolean;
  premiumGiftSticker?: ApiSticker;
  canPlayAnimatedEmojis?: boolean;
};

const APPEARANCE_DELAY = 10;

const ActionMessage: FC<OwnProps & StateProps> = ({
  message,
  isEmbedded,
  appearanceOrder = 0,
  isJustAdded,
  isLastInList,
  senderUser,
  senderChat,
  targetUserIds,
  targetMessage,
  targetChatId,
  targetChat,
  isFocused,
  focusDirection,
  noFocusHighlight,
  premiumGiftSticker,
  isInsideTopic,
  topic,
  memoFirstUnreadIdRef,
  canPlayAnimatedEmojis,
  observeIntersectionForReading,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  onPinnedIntersectionChange,
}) => {
  const { openPremiumModal, requestConfetti, checkGiftCode } = getActions();

  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  useOnIntersect(ref, observeIntersectionForReading);
  useEnsureMessage(
    message.chatId,
    message.replyInfo?.type === 'message' ? message.replyInfo.replyToMsgId : undefined,
    targetMessage,
  );
  useFocusMessage(ref, message.chatId, isFocused, focusDirection, noFocusHighlight, isJustAdded);

  useEffect(() => {
    if (!message.isPinned) return undefined;

    return () => {
      onPinnedIntersectionChange?.({ viewportPinnedIdsToRemove: [message.id], isUnmount: true });
    };
  }, [onPinnedIntersectionChange, message.isPinned, message.id]);

  const noAppearanceAnimation = appearanceOrder <= 0;
  const [isShown, markShown] = useFlag(noAppearanceAnimation);
  const isGift = Boolean(message.content.action?.text.startsWith('ActionGift'));
  const isGiftCode = Boolean(message.content.action?.text.startsWith('BoostingReceivedGift'));
  const isSuggestedAvatar = message.content.action?.type === 'suggestProfilePhoto' && message.content.action!.photo;
  const isJoinedMessage = isJoinedChannelMessage(message);

  useEffect(() => {
    if (noAppearanceAnimation) {
      return;
    }

    setTimeout(markShown, appearanceOrder * APPEARANCE_DELAY);
  }, [appearanceOrder, markShown, noAppearanceAnimation]);

  const isVisible = useIsIntersecting(ref, observeIntersectionForPlaying);

  const shouldShowConfettiRef = useRef((() => {
    const isUnread = memoFirstUnreadIdRef?.current && message.id >= memoFirstUnreadIdRef.current;
    return isGift && !message.isOutgoing && isUnread;
  })());

  useEffect(() => {
    if (isVisible && shouldShowConfettiRef.current) {
      shouldShowConfettiRef.current = false;
      requestConfetti({});
    }
  }, [isVisible, requestConfetti]);

  const { transitionClassNames } = useShowTransition(isShown, undefined, noAppearanceAnimation, false);

  // No need for expensive global updates on users and chats, so we avoid them
  const usersById = getGlobal().users.byId;
  const targetUsers = useMemo(() => {
    return targetUserIds
      ? targetUserIds.map((userId) => usersById?.[userId]).filter(Boolean)
      : undefined;
  }, [targetUserIds, usersById]);

  const renderContent = useCallback(() => {
    return renderActionMessageText(
      lang,
      message,
      senderUser,
      senderChat,
      targetUsers,
      targetMessage,
      targetChatId,
      topic,
      { isEmbedded },
      observeIntersectionForLoading,
      observeIntersectionForPlaying,
    );
  }, [
    isEmbedded, lang, message, observeIntersectionForLoading, observeIntersectionForPlaying,
    senderChat, senderUser, targetChatId, targetMessage, targetUsers, topic,
  ]);

  const {
    isContextMenuOpen, contextMenuPosition,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref);
  const isContextMenuShown = contextMenuPosition !== undefined;

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    preventMessageInputBlur(e);
    handleBeforeContextMenu(e);
  };

  const handlePremiumGiftClick = () => {
    openPremiumModal({
      isGift: true,
      fromUserId: senderUser?.id,
      toUserId: targetUserIds?.[0],
      monthsAmount: message.content.action?.months || 0,
    });
  };

  const handleGiftCodeClick = () => {
    const slug = message.content.action?.slug;
    if (!slug) return;
    checkGiftCode({ slug, message: { chatId: message.chatId, messageId: message.id } });
  };

  // TODO Refactoring for action rendering
  const shouldSkipRender = isInsideTopic && message.content.action?.text === 'TopicWasCreatedAction';
  if (shouldSkipRender) {
    return <span ref={ref} />;
  }

  if (isEmbedded) {
    return <span ref={ref} className="embedded-action-message">{renderContent()}</span>;
  }

  function renderGift() {
    return (
      <span className="action-message-gift" tabIndex={0} role="button" onClick={handlePremiumGiftClick}>
        <AnimatedIconFromSticker
          key={message.id}
          sticker={premiumGiftSticker}
          play={canPlayAnimatedEmojis}
          noLoop
          nonInteractive
        />
        <strong>{lang('ActionGiftPremiumTitle')}</strong>
        <span>{lang('ActionGiftPremiumSubtitle', lang('Months', message.content.action?.months, 'i'))}</span>

        <span className="action-message-button">{lang('ActionGiftPremiumView')}</span>
      </span>
    );
  }

  function renderGiftCode() {
    const isFromGiveaway = message.content.action?.isGiveaway;
    const isUnclaimed = message.content.action?.isUnclaimed;
    return (
      <span
        className="action-message-gift action-message-gift-code"
        tabIndex={0}
        role="button"
        onClick={handleGiftCodeClick}
      >
        <AnimatedIconFromSticker
          key={message.id}
          sticker={premiumGiftSticker}
          play={canPlayAnimatedEmojis}
          noLoop
          nonInteractive
        />
        <strong>{lang(isUnclaimed ? 'BoostingUnclaimedPrize' : 'BoostingCongratulations')}</strong>
        <span className="action-message-subtitle">
          {renderText(lang(isFromGiveaway ? 'BoostingReceivedGiftFrom' : isUnclaimed
            ? 'BoostingReceivedPrizeFrom' : 'BoostingYouHaveUnclaimedPrize',
          getChatTitle(lang, targetChat!)),
          ['simple_markdown'])}
        </span>
        <span className="action-message-subtitle">
          {renderText(lang(
            'BoostingUnclaimedPrizeDuration',
            lang('Months', message.content.action?.months, 'i'),
          ), ['simple_markdown'])}
        </span>

        <span className="action-message-button">{lang('BoostingReceivedGiftOpenBtn')}</span>
      </span>
    );
  }

  const className = buildClassName(
    'ActionMessage message-list-item',
    isFocused && !noFocusHighlight && 'focused',
    (isGift || isSuggestedAvatar) && 'centered-action',
    isContextMenuShown && 'has-menu-open',
    isLastInList && 'last-in-list',
    transitionClassNames,
  );

  return (
    <div
      ref={ref}
      id={getMessageHtmlId(message.id)}
      className={className}
      data-message-id={message.id}
      data-is-pinned={message.isPinned || undefined}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
    >
      {!isSuggestedAvatar && !isGiftCode && !isJoinedMessage && (
        <span className="action-message-content">{renderContent()}</span>
      )}
      {isGift && renderGift()}
      {isGiftCode && renderGiftCode()}
      {isSuggestedAvatar && (
        <ActionMessageSuggestedAvatar message={message} renderContent={renderContent} />
      )}
      {isJoinedMessage && <SimilarChannels chatId={targetChatId!} />}
      {contextMenuPosition && (
        <ContextMenuContainer
          isOpen={isContextMenuOpen}
          anchor={contextMenuPosition}
          message={message}
          messageListType="thread"
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message, threadId }): StateProps => {
    const {
      chatId, senderId, content,
    } = message;

    const userId = senderId;
    const { targetUserIds, targetChatId } = content.action || {};
    const targetMessageId = getMessageReplyInfo(message)?.replyToMsgId;
    const targetMessage = targetMessageId
      ? selectChatMessage(global, chatId, targetMessageId)
      : undefined;

    const isFocused = threadId ? selectIsMessageFocused(global, message, threadId) : false;
    const {
      direction: focusDirection,
      noHighlight: noFocusHighlight,
    } = (isFocused && selectTabState(global).focusedMessage) || {};

    const chat = selectChat(global, chatId);
    const isChat = chat && (isChatChannel(chat) || userId === chatId);
    const senderUser = !isChat && userId ? selectUser(global, userId) : undefined;
    const senderChat = isChat ? chat : undefined;

    const targetChat = targetChatId ? selectChat(global, targetChatId) : undefined;

    const giftDuration = content.action?.months;
    const premiumGiftSticker = selectGiftStickerForDuration(global, giftDuration);
    const topic = selectTopicFromMessage(global, message);

    return {
      senderUser,
      senderChat,
      targetChat,
      targetChatId,
      targetUserIds,
      targetMessage,
      isFocused,
      premiumGiftSticker,
      topic,
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
      ...(isFocused && {
        focusDirection,
        noFocusHighlight,
      }),
    };
  },
)(ActionMessage));
