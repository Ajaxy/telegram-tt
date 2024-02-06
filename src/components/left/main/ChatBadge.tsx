import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';

import type { ApiChat, ApiTopic } from '../../../api/types';
import type { Signal } from '../../../util/signals';

import buildClassName from '../../../util/buildClassName';
import { isSignal } from '../../../util/signals';
import { formatIntegerCompact } from '../../../util/textFormat';

import useDerivedState from '../../../hooks/useDerivedState';

import AnimatedCounter from '../../common/AnimatedCounter';
import ShowTransition from '../../ui/ShowTransition';

import './ChatBadge.scss';

type OwnProps = {
  chat: ApiChat;
  topic?: ApiTopic;
  wasTopicOpened?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  isSavedDialog?: boolean;
  shouldShowOnlyMostImportant?: boolean;
  forceHidden?: boolean | Signal<boolean>;
};

const ChatBadge: FC<OwnProps> = ({
  topic, chat, isPinned, isMuted, shouldShowOnlyMostImportant, wasTopicOpened, forceHidden, isSavedDialog,
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
      && Object.values(chat.topics).some((acc) => !acc.isMuted && acc.unreadCount);

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

  const isUnread = Boolean((unreadCount || hasUnreadMark) && !isSavedDialog);
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

    const pinnedElement = isPinned && (
      <div className={className}>
        <i className="icon icon-pinned-chat" />
      </div>
    );

    const visiblePinnedElement = !unreadCountElement && !unreadMentionsElement && !unreadReactionsElement
      && pinnedElement;

    const elements = [
      unopenedTopicElement, unreadReactionsElement, unreadMentionsElement, unreadCountElement, visiblePinnedElement,
    ].filter(Boolean);

    if (isSavedDialog) return pinnedElement;

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
