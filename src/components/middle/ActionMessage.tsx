import React, {
  FC, memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { ApiUser, ApiMessage, ApiChat } from '../../api/types';
import { FocusDirection } from '../../types';

import {
  selectUser,
  selectChatMessage,
  selectIsMessageFocused,
  selectChat,
} from '../../modules/selectors';
import { isChatChannel } from '../../modules/helpers';
import buildClassName from '../../util/buildClassName';
import renderText from '../common/helpers/renderText';
import { renderActionMessageText } from '../common/helpers/renderActionMessageText';
import useEnsureMessage from '../../hooks/useEnsureMessage';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import { ObserveFn, useOnIntersect } from '../../hooks/useIntersectionObserver';
import useFocusMessage from './message/hooks/useFocusMessage';
import useLang from '../../hooks/useLang';

import ContextMenuContainer from './message/ContextMenuContainer.async';
import useFlag from '../../hooks/useFlag';
import useShowTransition from '../../hooks/useShowTransition';
import { preventMessageInputBlur } from './helpers/preventMessageInputBlur';

type OwnProps = {
  message: ApiMessage;
  observeIntersection?: ObserveFn;
  isEmbedded?: boolean;
  appearanceOrder?: number;
  isLastInList?: boolean;
};

type StateProps = {
  usersById: Record<number, ApiUser>;
  sender?: ApiUser | ApiChat;
  targetUserIds?: number[];
  targetMessage?: ApiMessage;
  targetChatId?: number;
  isFocused: boolean;
  focusDirection?: FocusDirection;
  noFocusHighlight?: boolean;
};

const APPEARANCE_DELAY = 10;

const ActionMessage: FC<OwnProps & StateProps> = ({
  message,
  observeIntersection,
  isEmbedded,
  appearanceOrder = 0,
  isLastInList,
  usersById,
  sender,
  targetUserIds,
  targetMessage,
  targetChatId,
  isFocused,
  focusDirection,
  noFocusHighlight,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  useOnIntersect(ref, observeIntersection);
  useEnsureMessage(message.chatId, message.replyToMessageId, targetMessage);
  useFocusMessage(ref, message.chatId, isFocused, focusDirection, noFocusHighlight);

  const lang = useLang();

  const noAppearanceAnimation = appearanceOrder <= 0;
  const [isShown, markShown] = useFlag(noAppearanceAnimation);
  useEffect(() => {
    if (noAppearanceAnimation) {
      return;
    }

    setTimeout(markShown, appearanceOrder * APPEARANCE_DELAY);
  }, [appearanceOrder, markShown, noAppearanceAnimation]);
  const { transitionClassNames } = useShowTransition(isShown, undefined, noAppearanceAnimation, false);

  const targetUsers = useMemo(() => {
    return targetUserIds
      ? targetUserIds.map((userId) => usersById?.[userId]).filter<ApiUser>(Boolean as any)
      : undefined;
  }, [targetUserIds, usersById]);

  const content = renderActionMessageText(
    lang,
    message,
    sender,
    targetUsers,
    targetMessage,
    targetChatId,
    isEmbedded ? { isEmbedded: true, asPlain: true } : undefined,
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

  if (isEmbedded) {
    return <span className="embedded-action-message">{renderText(content as string)}</span>;
  }

  const className = buildClassName(
    'ActionMessage message-list-item',
    isFocused && !noFocusHighlight && 'focused',
    isContextMenuShown && 'has-menu-open',
    isLastInList && 'last-in-list',
    transitionClassNames,
  );

  return (
    <div
      ref={ref}
      id={`message${message.id}`}
      className={className}
      data-message-id={message.id}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
    >
      <span>{content}</span>
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
    const sender = chat && (isChatChannel(chat) || userId === message.chatId)
      ? chat
      : userId ? selectUser(global, userId) : undefined;

    return {
      usersById,
      sender,
      targetChatId,
      targetUserIds,
      targetMessage,
      isFocused,
      ...(isFocused && { focusDirection, noFocusHighlight }),
    };
  },
)(ActionMessage));
