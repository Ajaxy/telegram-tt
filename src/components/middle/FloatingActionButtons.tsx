import type { FC } from '../../lib/teact/teact';
import React, {
  useCallback, memo, useRef, useEffect,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { MessageListType } from '../../global/types';
import { MAIN_THREAD_ID } from '../../api/types';

import { selectChat, selectCurrentMessageList } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import fastSmoothScroll from '../../util/fastSmoothScroll';

import ScrollDownButton from './ScrollDownButton';

import styles from './FloatingActionButtons.module.scss';

type OwnProps = {
  isShown: boolean;
  canPost?: boolean;
  withExtraShift?: boolean;
};

type StateProps = {
  chatId?: string;
  messageListType?: MessageListType;
  unreadCount?: number;
  reactionsCount?: number;
  mentionsCount?: number;
};

const FOCUS_MARGIN = 20;

const FloatingActionButtons: FC<OwnProps & StateProps> = ({
  isShown,
  canPost,
  messageListType,
  chatId,
  unreadCount,
  reactionsCount,
  mentionsCount,
  withExtraShift,
}) => {
  const {
    focusNextReply, focusNextReaction, focusNextMention, fetchUnreadReactions,
    readAllMentions, readAllReactions, fetchUnreadMentions,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const elementRef = useRef<HTMLDivElement>(null);

  const hasUnreadReactions = Boolean(reactionsCount);
  const hasUnreadMentions = Boolean(mentionsCount);

  useEffect(() => {
    if (hasUnreadReactions && chatId) {
      fetchUnreadReactions({ chatId });
    }
  }, [chatId, fetchUnreadReactions, hasUnreadReactions]);

  useEffect(() => {
    if (hasUnreadMentions && chatId) {
      fetchUnreadMentions({ chatId });
    }
  }, [chatId, fetchUnreadMentions, hasUnreadMentions]);

  const handleClick = useCallback(() => {
    if (!isShown) {
      return;
    }

    if (messageListType === 'thread') {
      focusNextReply();
    } else {
      const messagesContainer = elementRef.current!.parentElement!.querySelector<HTMLDivElement>('.MessageList')!;
      const messageElements = messagesContainer.querySelectorAll<HTMLDivElement>('.message-list-item');
      const lastMessageElement = messageElements[messageElements.length - 1];
      if (!lastMessageElement) {
        return;
      }

      fastSmoothScroll(messagesContainer, lastMessageElement, 'end', FOCUS_MARGIN);
    }
  }, [isShown, messageListType, focusNextReply]);

  const fabClassName = buildClassName(
    styles.root,
    (isShown || Boolean(reactionsCount) || Boolean(mentionsCount)) && styles.revealed,
    (Boolean(reactionsCount) || Boolean(mentionsCount)) && !isShown && styles.onlyReactions,
    !canPost && styles.noComposer,
    !withExtraShift && styles.noExtraShift,
  );

  return (
    <div ref={elementRef} className={fabClassName}>
      {hasUnreadReactions && (
        <ScrollDownButton
          icon="heart-outline"
          ariaLabelLang="AccDescrReactionMentionDown"
          onClick={focusNextReaction}
          onReadAll={readAllReactions}
          unreadCount={reactionsCount}
        />
      )}
      {hasUnreadMentions && (
        <ScrollDownButton
          icon="mention"
          ariaLabelLang="AccDescrMentionDown"
          onClick={focusNextMention}
          onReadAll={readAllMentions}
          unreadCount={mentionsCount}
        />
      )}

      <ScrollDownButton
        icon="arrow-down"
        ariaLabelLang="AccDescrPageDown"
        onClick={handleClick}
        unreadCount={unreadCount}
        className={styles.unread}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const currentMessageList = selectCurrentMessageList(global);
    if (!currentMessageList) {
      return {};
    }

    const { chatId, threadId, type: messageListType } = currentMessageList;
    const chat = selectChat(global, chatId);

    const shouldShowCount = chat && threadId === MAIN_THREAD_ID && messageListType === 'thread';

    return {
      messageListType,
      chatId,
      reactionsCount: shouldShowCount ? chat.unreadReactionsCount : undefined,
      mentionsCount: shouldShowCount ? chat.unreadMentionsCount : undefined,
      unreadCount: shouldShowCount ? chat.unreadCount : undefined,
    };
  },
)(FloatingActionButtons));
