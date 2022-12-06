import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import type { ApiChat } from '../../../api/types';

import { formatIntegerCompact } from '../../../util/textFormat';
import buildClassName from '../../../util/buildClassName';

import ShowTransition from '../../ui/ShowTransition';
import AnimatedCounter from '../../common/AnimatedCounter';

import './Badge.scss';

type OwnProps = {
  chat: ApiChat;
  isPinned?: boolean;
  isMuted?: boolean;
};

const Badge: FC<OwnProps> = ({ chat, isPinned, isMuted }) => {
  const isShown = Boolean(
    chat.unreadCount || chat.unreadMentionsCount || chat.hasUnreadMark || isPinned || chat.unreadReactionsCount,
  );
  const isUnread = Boolean(chat.unreadCount || chat.hasUnreadMark);
  const className = buildClassName(
    'Badge',
    isMuted && 'muted',
    !isUnread && isPinned && 'pinned',
    isUnread && 'unread',
  );

  function renderContent() {
    const unreadReactionsElement = chat.unreadReactionsCount && (
      <div className={buildClassName('Badge reaction', isMuted && 'muted')}>
        <i className="icon-heart" />
      </div>
    );

    const unreadMentionsElement = chat.unreadMentionsCount && (
      <div className="Badge mention">
        <i className="icon-mention" />
      </div>
    );

    const unreadCountElement = (chat.hasUnreadMark || chat.unreadCount) ? (
      <div className={className}>
        {!chat.hasUnreadMark && <AnimatedCounter text={formatIntegerCompact(chat.unreadCount!)} />}
      </div>
    ) : undefined;

    const pinnedElement = isPinned && !unreadCountElement && !unreadMentionsElement && !unreadReactionsElement && (
      <div className={className}>
        <i className="icon-pinned-chat" />
      </div>
    );

    const elements = [unreadReactionsElement, unreadMentionsElement, unreadCountElement, pinnedElement].filter(Boolean);

    if (elements.length === 0) return undefined;

    if (elements.length === 1) return elements[0];

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
