import React, {
  FC, memo, useCallback, useEffect,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { ApiChat, ApiMessage, ApiUser } from '../../../api/types';

import {
  selectChat,
  selectChatMessage,
  selectSender,
  selectForwardedSender,
  selectUser,
  selectCurrentMessageList,
  selectReplyingToId,
  selectEditingId,
  selectEditingScheduledId,
  selectEditingMessage,
} from '../../../global/selectors';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';
import useShowTransition from '../../../hooks/useShowTransition';
import buildClassName from '../../../util/buildClassName';
import { isUserId } from '../../../global/helpers';

import Button from '../../ui/Button';
import EmbeddedMessage from '../../common/EmbeddedMessage';

import './ComposerEmbeddedMessage.scss';

type StateProps = {
  replyingToId?: number;
  editingId?: number;
  message?: ApiMessage;
  sender?: ApiUser | ApiChat;
  shouldAnimate?: boolean;
  forwardedMessagesCount?: number;
};

const FORWARD_RENDERING_DELAY = 300;

const ComposerEmbeddedMessage: FC<StateProps> = ({
  replyingToId,
  editingId,
  message,
  sender,
  shouldAnimate,
  forwardedMessagesCount,
}) => {
  const {
    setReplyingToId,
    setEditingId,
    focusMessage,
    exitForwardMode,
  } = getActions();

  const isShown = Boolean(
    ((replyingToId || editingId) && message)
    || (sender && forwardedMessagesCount),
  );
  const canAnimate = useAsyncRendering(
    [forwardedMessagesCount],
    forwardedMessagesCount ? FORWARD_RENDERING_DELAY : undefined,
  );

  const {
    shouldRender, transitionClassNames,
  } = useShowTransition(canAnimate && isShown, undefined, !shouldAnimate, undefined, !shouldAnimate);

  const clearEmbedded = useCallback(() => {
    if (replyingToId) {
      setReplyingToId({ messageId: undefined });
    } else if (editingId) {
      setEditingId({ messageId: undefined });
    } else if (forwardedMessagesCount) {
      exitForwardMode();
    }
  }, [replyingToId, editingId, forwardedMessagesCount, setReplyingToId, setEditingId, exitForwardMode]);

  useEffect(() => (isShown ? captureEscKeyListener(clearEmbedded) : undefined), [isShown, clearEmbedded]);

  const handleMessageClick = useCallback((): void => {
    focusMessage({ chatId: message!.chatId, messageId: message!.id });
  }, [focusMessage, message]);

  const className = buildClassName('ComposerEmbeddedMessage', transitionClassNames);

  const customText = forwardedMessagesCount && forwardedMessagesCount > 1
    ? `${forwardedMessagesCount} forwarded messages`
    : undefined;

  if (!shouldRender) {
    return undefined;
  }

  return (
    <div className={className}>
      <div>
        <Button round faded color="translucent" ariaLabel="Cancel replying" onClick={clearEmbedded}>
          <i className="icon-close" />
        </Button>
        <EmbeddedMessage
          className="inside-input"
          message={message}
          sender={sender}
          customText={customText}
          title={editingId ? 'Edit Message' : undefined}
          onClick={handleMessageClick}
        />
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const { chatId, threadId, type: messageListType } = selectCurrentMessageList(global) || {};
    if (!chatId || !threadId || !messageListType) {
      return {};
    }

    const {
      currentUserId,
      forwardMessages: { fromChatId, toChatId, messageIds: forwardMessageIds },
    } = global;

    const replyingToId = selectReplyingToId(global, chatId, threadId);
    const editingId = messageListType === 'scheduled'
      ? selectEditingScheduledId(global, chatId)
      : selectEditingId(global, chatId, threadId);
    const shouldAnimate = global.settings.byKey.animationLevel >= 1;
    const isForwarding = toChatId === chatId;

    let message;
    if (replyingToId) {
      message = selectChatMessage(global, chatId, replyingToId);
    } else if (editingId) {
      message = selectEditingMessage(global, chatId, threadId, messageListType);
    } else if (isForwarding && forwardMessageIds!.length === 1) {
      message = selectChatMessage(global, fromChatId!, forwardMessageIds![0]);
    }

    let sender: ApiChat | ApiUser | undefined;
    if (replyingToId && message) {
      const { forwardInfo } = message;
      const isChatWithSelf = chatId === currentUserId;

      if (forwardInfo && (forwardInfo.isChannelPost || isChatWithSelf)) {
        sender = selectForwardedSender(global, message);
      }

      if (!sender) {
        sender = selectSender(global, message);
      }
    } else if (isForwarding) {
      sender = isUserId(fromChatId!) ? selectUser(global, fromChatId!) : selectChat(global, fromChatId!);
    }

    return {
      replyingToId,
      editingId,
      message,
      sender,
      shouldAnimate,
      forwardedMessagesCount: isForwarding ? forwardMessageIds!.length : undefined,
    };
  },
)(ComposerEmbeddedMessage));
