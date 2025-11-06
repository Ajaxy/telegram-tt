import type { FC } from '../../lib/teact/teact';
import { memo, useEffect, useRef } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { MessageListType, ThreadId } from '../../types';
import { MAIN_THREAD_ID } from '../../api/types';

import { selectChat, selectCurrentMessageList, selectCurrentMiddleSearch } from '../../global/selectors';
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
  threadId?: ThreadId;
  unreadCount?: number;
  unreadReactions?: number[];
  unreadMentions?: number[];
  reactionsCount?: number;
  mentionsCount?: number;
};

const FloatingActionButtons: FC<OwnProps & StateProps> = ({
  withScrollDown,
  canPost,
  messageListType,
  chatId,
  threadId,
  unreadCount,
  unreadReactions,
  unreadMentions,
  reactionsCount,
  mentionsCount,
  withExtraShift,
}) => {
  const {
    focusNextReply, focusNextReaction, focusNextMention, fetchUnreadReactions,
    readAllMentions, readAllReactions, fetchUnreadMentions, scrollMessageListToBottom,
  } = getActions();

  const elementRef = useRef<HTMLDivElement>();

  const hasUnreadReactions = Boolean(reactionsCount);
  const hasUnreadMentions = Boolean(mentionsCount);

  const handleReadAllReactions = useLastCallback(() => {
    if (!chatId) return;
    readAllReactions({ chatId, threadId });
  });

  const handleReadAllMentions = useLastCallback(() => {
    if (!chatId) return;
    readAllMentions({ chatId, threadId });
  });

  useEffect(() => {
    if (hasUnreadReactions && chatId && !unreadReactions?.length) {
      fetchUnreadReactions({ chatId });
    }
  }, [chatId, fetchUnreadReactions, hasUnreadReactions, unreadReactions?.length]);

  useEffect(() => {
    if (hasUnreadReactions && chatId) {
      fetchUnreadReactions({ chatId });
    }
  }, [chatId, fetchUnreadReactions, hasUnreadReactions]);

  useEffect(() => {
    if (hasUnreadMentions && chatId && !unreadMentions?.length) {
      fetchUnreadMentions({ chatId });
    }
  }, [chatId, fetchUnreadMentions, hasUnreadMentions, unreadMentions?.length]);

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
      scrollMessageListToBottom();
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
        onReadAll={handleReadAllReactions}
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
        onReadAll={handleReadAllMentions}
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
  (global): Complete<StateProps> => {
    const currentMessageList = selectCurrentMessageList(global);
    if (!currentMessageList) {
      return {} as Complete<StateProps>;
    }

    const { chatId, threadId, type: messageListType } = currentMessageList;
    const chat = selectChat(global, chatId);
    const hasActiveMiddleSearch = Boolean(selectCurrentMiddleSearch(global));

    const shouldShowCount = chat && threadId === MAIN_THREAD_ID && messageListType === 'thread'
      && !hasActiveMiddleSearch;

    return {
      messageListType,
      chatId,
      threadId,
      reactionsCount: shouldShowCount ? chat.unreadReactionsCount : undefined,
      unreadReactions: shouldShowCount ? chat.unreadReactions : undefined,
      unreadMentions: shouldShowCount ? chat.unreadMentions : undefined,
      mentionsCount: shouldShowCount ? chat.unreadMentionsCount : undefined,
      unreadCount: shouldShowCount ? chat.unreadCount : undefined,
    };
  },
)(FloatingActionButtons));
