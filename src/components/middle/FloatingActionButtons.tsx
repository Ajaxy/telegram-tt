import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useRef } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { MessageListType } from '../../global/types';
import { MAIN_THREAD_ID } from '../../api/types';

import { selectChat, selectCurrentMessageList } from '../../global/selectors';
import animateScroll from '../../util/animateScroll';
import buildClassName from '../../util/buildClassName';

import useLastCallback from '../../hooks/useLastCallback';

import ScrollDownButton from './ScrollDownButton';

import styles from './FloatingActionButtons.module.scss';

type OwnProps = {
  withScrollDown: boolean;
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
  withScrollDown,
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

  const handleScrollDownClick = useLastCallback(() => {
    if (!withScrollDown) {
      return;
    }

    if (messageListType === 'thread') {
      focusNextReply();
    } else {
      const messagesContainer = elementRef.current!.parentElement!.querySelector<HTMLDivElement>(
        '.Transition_slide-active > .MessageList',
      )!;
      const messageElements = messagesContainer.querySelectorAll<HTMLDivElement>('.message-list-item');
      const lastMessageElement = messageElements[messageElements.length - 1];
      if (!lastMessageElement) {
        return;
      }

      animateScroll(messagesContainer, lastMessageElement, 'end', FOCUS_MARGIN);
    }
  });

  const fabClassName = buildClassName(
    styles.root,
    (withScrollDown || Boolean(reactionsCount) || Boolean(mentionsCount)) && styles.revealed,
    (Boolean(reactionsCount) || Boolean(mentionsCount)) && !withScrollDown && styles.hideScrollDown,
    !canPost && styles.noComposer,
    !withExtraShift && styles.noExtraShift,
  );

  return (
    <div ref={elementRef} className={fabClassName}>
      <ScrollDownButton
        icon="heart-outline"
        ariaLabelLang="AccDescrReactionMentionDown"
        onClick={focusNextReaction}
        onReadAll={readAllReactions}
        unreadCount={reactionsCount}
        className={buildClassName(
          styles.reactions,
          !hasUnreadReactions && styles.hidden,
          !hasUnreadMentions && styles.transformDown,
        )}
      />

      <ScrollDownButton
        icon="mention"
        ariaLabelLang="AccDescrMentionDown"
        onClick={focusNextMention}
        onReadAll={readAllMentions}
        unreadCount={mentionsCount}
        className={!hasUnreadMentions && styles.hidden}
      />

      <ScrollDownButton
        icon="arrow-down"
        ariaLabelLang="AccDescrPageDown"
        onClick={handleScrollDownClick}
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
