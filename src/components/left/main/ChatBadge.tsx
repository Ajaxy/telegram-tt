import React, { memo, useMemo } from '../../../lib/teact/teact';

import type { ApiChat, ApiTopic } from '../../../api/types';
import type { FC } from '../../../lib/teact/teact';

import type { Signal } from '../../../util/signals';
import { isSignal } from '../../../util/signals';
import { formatIntegerCompact } from '../../../util/textFormat';
import buildClassName from '../../../util/buildClassName';

import useDerivedState from '../../../hooks/useDerivedState';

import ShowTransition from '../../ui/ShowTransition';
import AnimatedCounter from '../../common/AnimatedCounter';

import './ChatBadge.scss';

type OwnProps = {
  chat: ApiChat;
  topic?: ApiTopic;
  wasTopicOpened?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  shouldShowOnlyMostImportant?: boolean;
  forceHidden?: boolean | Signal<boolean>;
};

const ChatBadge: FC<OwnProps> = ({
  topic, chat, isPinned, isMuted, shouldShowOnlyMostImportant, wasTopicOpened, forceHidden,
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

  const resolvedForceHidden = useDerivedState(
    () => (isSignal(forceHidden) ? forceHidden() : forceHidden),
    [forceHidden],
  );
  const isShown = !resolvedForceHidden && Boolean(
    unreadCount || unreadMentionsCount || hasUnreadMark || isPinned || unreadReactionsCount
    || isTopicUnopened,
  );

  const isUnread = Boolean(unreadCount || hasUnreadMark);
  const className = buildClassName(
    'ChatBadge',
    shouldBeMuted && 'muted',
    !isUnread && isPinned && 'pinned',
    isUnread && 'unread',
  );

  function renderContent() {
    const unreadReactionsElement = unreadReactionsCount && (
      <div className={buildClassName('ChatBadge reaction', shouldBeMuted && 'muted')}>
        <i className="icon icon-heart" />
      </div>
    );

    const unreadMentionsElement = unreadMentionsCount && (
      <div className="ChatBadge mention">
        <i className="icon icon-mention" />
      </div>
    );

    const unopenedTopicElement = isTopicUnopened && (
      <div className={buildClassName('ChatBadge unopened', shouldBeMuted && 'muted')} />
    );

    const unreadCountElement = (hasUnreadMark || unreadCount) ? (
      <div className={className}>
        {!hasUnreadMark && <AnimatedCounter text={formatIntegerCompact(unreadCount!)} />}
      </div>
    ) : undefined;

    const pinnedElement = isPinned && !unreadCountElement && !unreadMentionsElement && !unreadReactionsElement && (
      <div className={className}>
        <i className="icon icon-pinned-chat" />
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
      <div className="ChatBadge-wrapper">
        {elements}
      </div>
    );
  }

  return (
    <ShowTransition isCustom className="ChatBadge-transition" isOpen={isShown}>
      {renderContent()}
    </ShowTransition>
  );
};

export default memo(ChatBadge);
