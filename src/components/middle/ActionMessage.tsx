import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiUser, ApiMessage, ApiChat, ApiSticker, ApiTopic,
} from '../../api/types';
import type { FocusDirection } from '../../types';

import {
  selectUser,
  selectChatMessage,
  selectIsMessageFocused,
  selectChat,
  selectTopicFromMessage,
} from '../../global/selectors';
import { getMessageHtmlId, isChatChannel } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import { renderActionMessageText } from '../common/helpers/renderActionMessageText';
import { preventMessageInputBlur } from './helpers/preventMessageInputBlur';
import useEnsureMessage from '../../hooks/useEnsureMessage';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import { useIsIntersecting, useOnIntersect } from '../../hooks/useIntersectionObserver';
import useFocusMessage from './message/hooks/useFocusMessage';
import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';
import useShowTransition from '../../hooks/useShowTransition';

import ContextMenuContainer from './message/ContextMenuContainer.async';
import AnimatedIconFromSticker from '../common/AnimatedIconFromSticker';

type OwnProps = {
  message: ApiMessage;
  observeIntersectionForReading?: ObserveFn;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  isEmbedded?: boolean;
  appearanceOrder?: number;
  isLastInList?: boolean;
  isInsideTopic?: boolean;
  memoFirstUnreadIdRef?: { current: number | undefined };
};

type StateProps = {
  usersById: Record<string, ApiUser>;
  senderUser?: ApiUser;
  senderChat?: ApiChat;
  targetUserIds?: string[];
  targetMessage?: ApiMessage;
  targetChatId?: string;
  isFocused: boolean;
  topic?: ApiTopic;
  focusDirection?: FocusDirection;
  noFocusHighlight?: boolean;
  premiumGiftSticker?: ApiSticker;
};

const APPEARANCE_DELAY = 10;

const ActionMessage: FC<OwnProps & StateProps> = ({
  message,
  isEmbedded,
  appearanceOrder = 0,
  isLastInList,
  usersById,
  senderUser,
  senderChat,
  targetUserIds,
  targetMessage,
  targetChatId,
  isFocused,
  focusDirection,
  noFocusHighlight,
  premiumGiftSticker,
  isInsideTopic,
  topic,
  memoFirstUnreadIdRef,
  observeIntersectionForReading,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
}) => {
  const { openPremiumModal, requestConfetti } = getActions();

  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  useOnIntersect(ref, observeIntersectionForReading);
  useEnsureMessage(message.chatId, message.replyToMessageId, targetMessage);
  useFocusMessage(ref, message.chatId, isFocused, focusDirection, noFocusHighlight);

  const noAppearanceAnimation = appearanceOrder <= 0;
  const [isShown, markShown] = useFlag(noAppearanceAnimation);
  const isGift = Boolean(message.content.action?.text.startsWith('ActionGift'));

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
      requestConfetti();
    }
  }, [isVisible, requestConfetti]);

  const { transitionClassNames } = useShowTransition(isShown, undefined, noAppearanceAnimation, false);

  const targetUsers = useMemo(() => {
    return targetUserIds
      ? targetUserIds.map((userId) => usersById?.[userId]).filter(Boolean)
      : undefined;
  }, [targetUserIds, usersById]);

  const content = renderActionMessageText(
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

  // TODO: Refactoring for action rendering
  const shouldSkipRender = isInsideTopic && message.content.action?.text === 'TopicWasCreatedAction';
  if (shouldSkipRender) {
    return <span ref={ref} />;
  }

  if (isEmbedded) {
    return <span ref={ref} className="embedded-action-message">{content}</span>;
  }

  function renderGift() {
    return (
      <span className="action-message-gift" tabIndex={0} role="button" onClick={handlePremiumGiftClick}>
        <AnimatedIconFromSticker
          key={message.id}
          sticker={premiumGiftSticker}
          play
          noLoop
          nonInteractive
        />
        <strong>{lang('ActionGiftPremiumTitle')}</strong>
        <span>{lang('ActionGiftPremiumSubtitle', lang('Months', message.content.action?.months, 'i'))}</span>

        <span className="action-message-button">{lang('ActionGiftPremiumView')}</span>
      </span>
    );
  }

  const className = buildClassName(
    'ActionMessage message-list-item',
    isFocused && !noFocusHighlight && 'focused',
    isGift && 'premium-gift',
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
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
    >
      <span>{content}</span>
      {isGift && renderGift()}
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
  (global, { message }): StateProps => {
    const { byId: usersById } = global.users;
    const userId = message.senderId;
    const { targetUserIds, targetChatId } = message.content.action || {};
    const targetMessageId = message.replyToMessageId;
    const targetMessage = targetMessageId
      ? selectChatMessage(global, message.chatId, targetMessageId)
      : undefined;

    const isFocused = selectIsMessageFocused(global, message);
    const { direction: focusDirection, noHighlight: noFocusHighlight } = (isFocused && global.focusedMessage) || {};

    const chat = selectChat(global, message.chatId);
    const isChat = chat && (isChatChannel(chat) || userId === message.chatId);
    const senderUser = !isChat && userId ? selectUser(global, userId) : undefined;
    const senderChat = isChat ? chat : undefined;
    const premiumGiftSticker = global.premiumGifts?.stickers?.[0];
    const topic = selectTopicFromMessage(global, message);

    return {
      usersById,
      senderUser,
      senderChat,
      targetChatId,
      targetUserIds,
      targetMessage,
      isFocused,
      premiumGiftSticker,
      topic,
      ...(isFocused && { focusDirection, noFocusHighlight }),
    };
  },
)(ActionMessage));
