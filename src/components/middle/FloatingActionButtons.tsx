import { memo, useEffect, useRef } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { MessageListType, ThreadId, ThreadReadState } from '../../types';

import { selectChat, selectCurrentMessageList, selectCurrentMiddleSearch } from '../../global/selectors';
import { selectThreadReadState } from '../../global/selectors/threads';
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
  threadReadState?: ThreadReadState;
  shouldShowCount?: boolean;
};

const FloatingActionButtons = ({
  withScrollDown,
  canPost,
  messageListType,
  chatId,
  threadId,
  withExtraShift,
  threadReadState,
  shouldShowCount,
}: OwnProps & StateProps) => {
  const {
    focusNextReply, focusNextReaction, focusNextMention, loadUnreadReactions,
    readAllMentions, readAllReactions, loadUnreadMentions, scrollMessageListToBottom,
  } = getActions();

  const elementRef = useRef<HTMLDivElement>();

  const {
    unreadReactionsCount, unreadMentionsCount, unreadCount, unreadReactions, unreadMentions,
  } = (shouldShowCount && threadReadState) || {};

  const hasUnreadReactions = Boolean(unreadReactionsCount);
  const hasUnreadMentions = Boolean(unreadMentionsCount);

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
      loadUnreadReactions({ chatId, threadId });
    }
  }, [chatId, threadId, hasUnreadReactions, unreadReactions?.length]);

  useEffect(() => {
    if (hasUnreadMentions && chatId && !unreadMentions?.length) {
      loadUnreadMentions({ chatId, threadId });
    }
  }, [chatId, threadId, hasUnreadMentions, unreadMentions?.length]);

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

  const handleFocusNextReaction = useLastCallback(() => {
    if (!chatId) return;
    focusNextReaction({ chatId, threadId });
  });

  const handleFocusNextMention = useLastCallback(() => {
    if (!chatId) return;
    focusNextMention({ chatId, threadId });
  });

  const fabClassName = buildClassName(
    styles.root,
    (withScrollDown || hasUnreadReactions || hasUnreadMentions) && styles.revealed,
    (hasUnreadReactions || hasUnreadMentions) && !withScrollDown && styles.hideScrollDown,
    !canPost && styles.noComposer,
    !withExtraShift && styles.noExtraShift,
  );

  return (
    <div ref={elementRef} className={fabClassName}>
      <ScrollDownButton
        icon="heart-outline"
        ariaLabelLang="AccDescrReactionMentionDown"
        onClick={handleFocusNextReaction}
        onReadAll={handleReadAllReactions}
        unreadCount={unreadReactionsCount}
        className={buildClassName(
          styles.reactions,
          !hasUnreadReactions && styles.hidden,
          !hasUnreadMentions && styles.transformDown,
        )}
      />

      <ScrollDownButton
        icon="mention"
        ariaLabelLang="AccDescrMentionDown"
        onClick={handleFocusNextMention}
        onReadAll={handleReadAllMentions}
        unreadCount={unreadMentionsCount}
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

    const shouldShowCount = chat && messageListType === 'thread' && !hasActiveMiddleSearch;

    return {
      messageListType,
      chatId,
      threadId,
      threadReadState: selectThreadReadState(global, chatId, threadId),
      shouldShowCount,
    };
  },
)(FloatingActionButtons));
