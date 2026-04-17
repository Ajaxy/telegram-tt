import { memo, useEffect, useRef } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { MessageListType, ThreadId, ThreadReadState } from '../../types';
import type { IconName } from '../../types/icons';

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

type UnreadCountButton = {
  icon: IconName;
  ariaLabelLang: string;
  unreadCount?: number;
  isHidden: boolean;
  hiddenUnreadCountButtonsBelow: number;
  onClick: VoidFunction;
  onReadAll: VoidFunction;
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
    focusNextPollVote,
    focusNextReply,
    focusNextReaction,
    focusNextMention,
    loadUnreadPollVotes,
    loadUnreadReactions,
    readAllMentions,
    readAllPollVotes,
    readAllReactions,
    loadUnreadMentions,
    scrollMessageListToBottom,
  } = getActions();

  const elementRef = useRef<HTMLDivElement>();

  const {
    unreadPollVotesCount,
    unreadReactionsCount,
    unreadMentionsCount,
    unreadCount,
    unreadPollVotes,
    unreadReactions,
    unreadMentions,
  } = (shouldShowCount && threadReadState) || {};

  const hasUnreadPollVotes = Boolean(unreadPollVotesCount);
  const hasUnreadReactions = Boolean(unreadReactionsCount);
  const hasUnreadMentions = Boolean(unreadMentionsCount);

  const handleReadAllPollVotes = useLastCallback(() => {
    if (!chatId) return;
    readAllPollVotes({ chatId, threadId });
  });

  const handleReadAllReactions = useLastCallback(() => {
    if (!chatId) return;
    readAllReactions({ chatId, threadId });
  });

  const handleReadAllMentions = useLastCallback(() => {
    if (!chatId) return;
    readAllMentions({ chatId, threadId });
  });

  useEffect(() => {
    if (hasUnreadPollVotes && chatId && !unreadPollVotes?.length) {
      loadUnreadPollVotes({ chatId, threadId });
    }
  }, [chatId, threadId, hasUnreadPollVotes, unreadPollVotes?.length]);

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

  const handleFocusNextPollVote = useLastCallback(() => {
    if (!chatId) return;
    focusNextPollVote({ chatId, threadId });
  });

  const handleFocusNextMention = useLastCallback(() => {
    if (!chatId) return;
    focusNextMention({ chatId, threadId });
  });

  const unreadCountButtonsConfig = [
    {
      icon: 'poll',
      ariaLabelLang: 'AccDescrPollVoteDown',
      unreadCount: unreadPollVotesCount,
      isHidden: !hasUnreadPollVotes,
      onClick: handleFocusNextPollVote,
      onReadAll: handleReadAllPollVotes,
    },
    {
      icon: 'heart-outline',
      ariaLabelLang: 'AccDescrReactionMentionDown',
      unreadCount: unreadReactionsCount,
      isHidden: !hasUnreadReactions,
      onClick: handleFocusNextReaction,
      onReadAll: handleReadAllReactions,
    },
    {
      icon: 'mention',
      ariaLabelLang: 'AccDescrMentionDown',
      unreadCount: unreadMentionsCount,
      isHidden: !hasUnreadMentions,
      onClick: handleFocusNextMention,
      onReadAll: handleReadAllMentions,
    },
  ] satisfies Omit<UnreadCountButton, 'hiddenUnreadCountButtonsBelow'>[];

  let hiddenUnreadCountButtonsBelow = 0;
  const unreadCountButtons = unreadCountButtonsConfig.reduceRight<UnreadCountButton[]>((result, button) => {
    result.unshift({
      ...button,
      hiddenUnreadCountButtonsBelow,
    });

    if (button.isHidden) {
      hiddenUnreadCountButtonsBelow++;
    }

    return result;
  }, []);

  const hasUnreadCountButtons = unreadCountButtons.some((button) => !button.isHidden);

  const buildUnreadCountButtonClassName = (button: UnreadCountButton) => buildClassName(
    styles.unreadCountButton,
    button.isHidden && styles.hidden,
    button.hiddenUnreadCountButtonsBelow === 1 && styles.transformDown,
    button.hiddenUnreadCountButtonsBelow === 2 && styles.transformDownDouble,
  );

  const fabClassName = buildClassName(
    styles.root,
    (withScrollDown || hasUnreadCountButtons) && styles.revealed,
    hasUnreadCountButtons && !withScrollDown && styles.hideScrollDown,
    !canPost && styles.noComposer,
    !withExtraShift && styles.noExtraShift,
  );

  return (
    <div ref={elementRef} className={fabClassName}>
      {unreadCountButtons.map((button) => (
        <ScrollDownButton
          key={button.icon}
          icon={button.icon}
          ariaLabelLang={button.ariaLabelLang}
          onClick={button.onClick}
          onReadAll={button.onReadAll}
          unreadCount={button.unreadCount}
          className={buildUnreadCountButtonClassName(button)}
        />
      ))}

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
      return {
        chatId: undefined,
        messageListType: undefined,
        shouldShowCount: undefined,
        threadId: undefined,
        threadReadState: undefined,
      };
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
