import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useRef } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiSponsoredMessage } from '../../api/types';
import type { MessageListType } from '../../global/types';
import { MAIN_THREAD_ID } from '../../api/types';

import { selectChat, selectCurrentMessageList, selectSponsoredMessage } from '../../global/selectors';
import animateScroll from '../../util/animateScroll';
import buildClassName from '../../util/buildClassName';
import { REM } from '../common/helpers/mediaDimensions';

import useLastCallback from '../../hooks/useLastCallback';

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
  sponsoredMessage?: ApiSponsoredMessage;
};

const FOCUS_MARGIN = 5.625 * REM;
const FOCUS_SPONSORED_MARGIN = 10 * REM + FOCUS_MARGIN;

const getLastMessageElement = (container: HTMLDivElement): HTMLDivElement | undefined => {
  const messageElements = container.querySelectorAll<HTMLDivElement>('.message-list-item');

  return messageElements[messageElements.length - 1];
};

const FloatingActionButtons: FC<OwnProps & StateProps> = ({
  isShown,
  canPost,
  messageListType,
  chatId,
  unreadCount,
  reactionsCount,
  mentionsCount,
  withExtraShift,
  sponsoredMessage,
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

  const handleClick = useLastCallback(() => {
    if (!isShown) return;

    if (messageListType === 'thread') focusNextReply();

    if (messageListType === 'pinned') {
      const container = elementRef.current?.parentElement?.querySelector<HTMLDivElement>('.MessageList.type-pinned');

      if (!container) return;
      const lastMessageElement = getLastMessageElement(container);

      if (!lastMessageElement) return;
      animateScroll(container, lastMessageElement, 'end', sponsoredMessage ? FOCUS_SPONSORED_MARGIN : FOCUS_MARGIN);
    }

    if (messageListType === 'scheduled') {
      const container = elementRef.current?.parentElement?.querySelector<HTMLDivElement>('.MessageList.type-scheduled');

      if (!container) return;
      const lastMessageElement = getLastMessageElement(container);

      if (!lastMessageElement) return;
      animateScroll(container, lastMessageElement, 'end', FOCUS_MARGIN);
    }
  });

  const fabClassName = buildClassName(
    styles.root,
    (isShown || Boolean(reactionsCount) || Boolean(mentionsCount)) && styles.revealed,
    (Boolean(reactionsCount) || Boolean(mentionsCount)) && !isShown && styles.onlyReactions,
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
      sponsoredMessage: selectSponsoredMessage(global, chatId),
    };
  },
)(FloatingActionButtons));
