import React, { FC, memo } from '../../../lib/teact/teact';

import { ApiChat } from '../../../api/types';

import { formatIntegerCompact } from '../../../util/textFormat';
import buildClassName from '../../../util/buildClassName';

import ShowTransition from '../../ui/ShowTransition';

import './Badge.scss';

type OwnProps = {
  chat: ApiChat;
  isPinned?: boolean;
  isMuted?: boolean;
};

const Badge: FC<OwnProps> = ({ chat, isPinned, isMuted }) => {
  const isShown = Boolean(chat.unreadCount || chat.hasUnreadMark || isPinned);
  const isUnread = Boolean(chat.unreadCount || chat.hasUnreadMark);
  const className = buildClassName(
    'Badge',
    isMuted && 'muted',
    !isUnread && isPinned && 'pinned',
    isUnread && 'unread',
  );

  function renderContent() {
    if (chat.unreadCount) {
      if (chat.unreadMentionsCount) {
        return (
          <div className="Badge-wrapper">
            <div className="Badge mention">
              <i className="icon-mention" />
            </div>
            <div className={className}>
              {formatIntegerCompact(chat.unreadCount)}
            </div>
          </div>
        );
      }

      return (
        <div className={className}>
          {formatIntegerCompact(chat.unreadCount)}
        </div>
      );
    } else if (chat.hasUnreadMark) {
      return (
        <div className={className} />
      );
    } else if (isPinned) {
      return (
        <div className={className}>
          <i className="icon-pinned-chat" />
        </div>
      );
    }

    return undefined;
  }

  return (
    <ShowTransition isCustom className="Badge-transition" isOpen={isShown}>
      {renderContent()}
    </ShowTransition>
  );
};

export default memo(Badge);
