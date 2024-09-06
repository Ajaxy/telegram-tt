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

import { getChatTitle, getMessageHtmlId, isJoinedChannelMessage } from '../../global/helpers';
import { getMessageReplyInfo } from '../../global/helpers/replies';
import {
  selectCanPlayAnimatedEmojis,
  selectChat,
  selectChatMessage,
  selectGiftStickerForDuration,
  selectGiftStickerForStars,
  selectIsMessageFocused,
  selectTabState,
  selectTopicFromMessage,
  selectUser,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatInteger } from '../../util/textFormat';
import { renderActionMessageText } from '../common/helpers/renderActionMessageText';
import renderText from '../common/helpers/renderText';
import { preventMessageInputBlur } from './helpers/preventMessageInputBlur';

import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useEnsureMessage from '../../hooks/useEnsureMessage';
import useFlag from '../../hooks/useFlag';
import { useIsIntersecting, useOnIntersect } from '../../hooks/useIntersectionObserver';
import useOldLang from '../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';
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
  starGiftSticker?: ApiSticker;
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
  starGiftSticker,
  isInsideTopic,
  topic,
  memoFirstUnreadIdRef,
  canPlayAnimatedEmojis,
  observeIntersectionForReading,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  onPinnedIntersectionChange,
}) => {
  const {
    openPremiumModal, requestConfetti, checkGiftCode, getReceipt, openStarsTransactionFromGift,
  } = getActions();

  const oldLang = useOldLang();

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
  const isPremiumGift = message.content.action?.type === 'giftPremium';
  const isGiftCode = message.content.action?.type === 'giftCode';
  const isSuggestedAvatar = message.content.action?.type === 'suggestProfilePhoto' && message.content.action!.photo;
  const isJoinedMessage = isJoinedChannelMessage(message);
  const isStarsGift = message.content.action?.type === 'giftStars';

  useEffect(() => {
    if (noAppearanceAnimation) {
      return;
    }

    setTimeout(markShown, appearanceOrder * APPEARANCE_DELAY);
  }, [appearanceOrder, markShown, noAppearanceAnimation]);

  const isVisible = useIsIntersecting(ref, observeIntersectionForPlaying);

  const shouldShowConfettiRef = useRef((() => {
    const isUnread = memoFirstUnreadIdRef?.current && message.id >= memoFirstUnreadIdRef.current;
    return isPremiumGift && !message.isOutgoing && isUnread;
  })());

  useEffect(() => {
    if (isVisible && shouldShowConfettiRef.current) {
      shouldShowConfettiRef.current = false;
      requestConfetti({ withStars: true });
    }
  }, [isVisible, requestConfetti]);

  const { transitionClassNames } = useShowTransitionDeprecated(isShown, undefined, noAppearanceAnimation, false);

  // No need for expensive global updates on users and chats, so we avoid them
  const usersById = getGlobal().users.byId;
  const targetUsers = useMemo(() => {
    return targetUserIds
      ? targetUserIds.map((userId) => usersById?.[userId]).filter(Boolean)
      : undefined;
  }, [targetUserIds, usersById]);

  const renderContent = useCallback(() => {
    return renderActionMessageText(
      oldLang,
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
    isEmbedded, message, observeIntersectionForLoading, observeIntersectionForPlaying, oldLang,
    senderChat, senderUser, targetChatId, targetMessage, targetUsers, topic,
  ]);

  const {
    isContextMenuOpen, contextMenuAnchor,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref);
  const isContextMenuShown = contextMenuAnchor !== undefined;

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    preventMessageInputBlur(e);
    handleBeforeContextMenu(e);
  };

  const handleStarGiftClick = () => {
    openStarsTransactionFromGift({
      chatId: message.chatId,
      messageId: message.id,
    });
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

  const handleClick = () => {
    if (message.content.action?.type === 'receipt') {
      getReceipt({
        chatId: message.chatId,
        messageId: message.id,
      });
    }
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
      <span
        className="action-message-gift"
        tabIndex={0}
        role="button"
        onClick={handlePremiumGiftClick}
      >
        <AnimatedIconFromSticker
          key={message.id}
          sticker={premiumGiftSticker}
          play={canPlayAnimatedEmojis}
          noLoop
          nonInteractive
        />
        <strong>{oldLang('ActionGiftPremiumTitle')}</strong>
        <span>
          {oldLang('ActionGiftPremiumSubtitle', oldLang('Months', message.content.action?.months, 'i'))}
        </span>

        <span className="action-message-button">{oldLang('ActionGiftPremiumView')}</span>
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
        <strong>
          {oldLang(isUnclaimed ? 'BoostingUnclaimedPrize' : 'BoostingCongratulations')}
        </strong>
        <span className="action-message-subtitle">
          {targetChat && renderText(oldLang(isFromGiveaway ? 'BoostingReceivedGiftFrom' : isUnclaimed
            ? 'BoostingReceivedPrizeFrom' : 'BoostingYouHaveUnclaimedPrize',
          getChatTitle(oldLang, targetChat)),
          ['simple_markdown'])}
        </span>
        <span className="action-message-subtitle">
          {renderText(oldLang(
            'BoostingUnclaimedPrizeDuration',
            oldLang('Months', message.content.action?.months, 'i'),
          ), ['simple_markdown'])}
        </span>

        <span className="action-message-button">{
          oldLang('BoostingReceivedGiftOpenBtn')
        }
        </span>
      </span>
    );
  }

  function renderStarsGift() {
    return (
      <span
        className="action-message-gift action-message-gift-code"
        tabIndex={0}
        role="button"
        onClick={handleStarGiftClick}
      >
        <AnimatedIconFromSticker
          key={message.id}
          sticker={starGiftSticker}
          play={canPlayAnimatedEmojis}
          noLoop
          nonInteractive
        />
        <div className="action-message-stars-balance">
          {formatInteger(message.content.action!.stars!)}
          <strong>{oldLang('Stars')}</strong>
        </div>
        <span className="action-message-stars-subtitle">
          {renderText(
            oldLang(!message.isOutgoing
              ? 'ActionGiftStarsSubtitleYou' : 'ActionGiftStarsSubtitle', getChatTitle(oldLang, targetChat!)),
            ['simple_markdown'],
          )}
        </span>
        <span className="action-message-button">{
          oldLang('ActionGiftPremiumView')
        }
        </span>
      </span>
    );
  }

  const className = buildClassName(
    'ActionMessage message-list-item',
    isFocused && !noFocusHighlight && 'focused',
    (isPremiumGift || isSuggestedAvatar) && 'centered-action',
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
        <span className="action-message-content" onClick={handleClick}>{renderContent()}</span>
      )}
      {isPremiumGift && renderGift()}
      {isGiftCode && renderGiftCode()}
      {isStarsGift && renderStarsGift()}
      {isSuggestedAvatar && (
        <ActionMessageSuggestedAvatar message={message} renderContent={renderContent} />
      )}
      {isJoinedMessage && <SimilarChannels chatId={targetChatId!} />}
      {contextMenuAnchor && (
        <ContextMenuContainer
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
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

    const senderUser = selectUser(global, senderId || chatId);
    const senderChat = selectChat(global, chatId);

    const targetChat = targetChatId ? selectChat(global, targetChatId) : undefined;

    const giftDuration = content.action?.months;
    const premiumGiftSticker = selectGiftStickerForDuration(global, giftDuration);

    const starCount = content.action?.stars;
    const starGiftSticker = selectGiftStickerForStars(global, starCount);

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
      starGiftSticker,
      topic,
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
      ...(isFocused && {
        focusDirection,
        noFocusHighlight,
      }),
    };
  },
)(ActionMessage));
