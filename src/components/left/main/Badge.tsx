import React, { memo, useMemo } from '../../../lib/teact/teact';

import type { ApiChat, ApiTopic } from '../../../api/types';
import type { FC } from '../../../lib/teact/teact';

import { formatIntegerCompact } from '../../../util/textFormat';
import buildClassName from '../../../util/buildClassName';

import ShowTransition from '../../ui/ShowTransition';
import AnimatedCounter from '../../common/AnimatedCounter';

import './Badge.scss';

type OwnProps = {
  chat: ApiChat;
  topic?: ApiTopic;
  wasTopicOpened?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  shouldShowOnlyMostImportant?: boolean;
};

const Badge: FC<OwnProps> = ({
  topic, chat, isPinned, isMuted, shouldShowOnlyMostImportant, wasTopicOpened,
}) => {
  const {
    unreadMentionsCount = 0, unreadReactionsCount = 0,
  } = !chat.isForum ? chat : {}; // TODO[forums] Unread mentions and reactions temporarily disabled for forums

  const isTopicUnopened = !isPinned && topic && !wasTopicOpened;
  const isForum = chat.isForum && !topic;
  const topicsWithUnread = useMemo(() => (
    isForum && chat?.topics ? Object.values(chat.topics).filter(({ unreadCount }) => unreadCount) : undefined
  ), [chat, isForum]);

  const unreadCount = useMemo(() => (
    isForum
      // If we have unmuted topics, display the count of those. Otherwise, display the count of all topics.
      ? ((isMuted && topicsWithUnread?.filter((acc) => acc.isMuted === false).length)
        || topicsWithUnread?.length)
      : (topic || chat).unreadCount
  ), [chat, topic, topicsWithUnread, isForum, isMuted]);

  const shouldBeMuted = useMemo(() => {
    const hasUnmutedUnreadTopics = chat.topics
      && Object.values(chat.topics).some((acc) => acc.isMuted && acc.unreadCount);

    return isMuted || (chat.topics && !hasUnmutedUnreadTopics);
  }, [chat, isMuted]);

  const hasUnreadMark = topic ? false : chat.hasUnreadMark;

  const isShown = Boolean(
    unreadCount || unreadMentionsCount || hasUnreadMark || isPinned || unreadReactionsCount
    || isTopicUnopened,
  );

  const isUnread = Boolean(unreadCount || hasUnreadMark);
  const className = buildClassName(
    'Badge',
    shouldBeMuted && 'muted',
    !isUnread && isPinned && 'pinned',
    isUnread && 'unread',
  );

  function renderContent() {
    const unreadReactionsElement = unreadReactionsCount && (
      <div className={buildClassName('Badge reaction', shouldBeMuted && 'muted')}>
        <i className="icon-heart" />
      </div>
    );

    const unreadMentionsElement = unreadMentionsCount && (
      <div className="Badge mention">
        <i className="icon-mention" />
      </div>
    );

    const unopenedTopicElement = isTopicUnopened && (
      <div className={buildClassName('Badge unopened', shouldBeMuted && 'muted')} />
    );

    const unreadCountElement = (hasUnreadMark || unreadCount) ? (
      <div className={className}>
        {!hasUnreadMark && <AnimatedCounter text={formatIntegerCompact(unreadCount!)} />}
      </div>
    ) : undefined;

    const pinnedElement = isPinned && !unreadCountElement && !unreadMentionsElement && !unreadReactionsElement && (
      <div className={className}>
        <i className="icon-pinned-chat" />
      </div>
    );

    const elements = [
      unopenedTopicElement, unreadReactionsElement, unreadMentionsElement, unreadCountElement, pinnedElement,
    ].filter(Boolean);

    if (elements.length === 0) return undefined;

    if (elements.length === 1) return elements[0];

    if (shouldShowOnlyMostImportant) {
      const importanceOrderedElements = [
        unreadMentionsElement, unreadCountElement, unreadReactionsElement, pinnedElement,
      ].filter(Boolean);
      return importanceOrderedElements[0];
    }

    return (
      <div className="Badge-wrapper">
        {elements}
      </div>
    );
  }

  return (
    <ShowTransition isCustom className="Badge-transition" isOpen={isShown}>
      {renderContent()}
    </ShowTransition>
  );
};

export default memo(Badge);
