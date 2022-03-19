import React, {
  FC, memo, useCallback, useMemo,
} from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import {
  ApiChat, ApiThreadInfo, ApiUser,
} from '../../../api/types';

import { isUserId } from '../../../global/helpers';
import { formatIntegerCompact } from '../../../util/textFormat';
import buildClassName from '../../../util/buildClassName';
import useLang from '../../../hooks/useLang';

import Avatar from '../../common/Avatar';

import './CommentButton.scss';

type OwnProps = {
  threadInfo: ApiThreadInfo;
  disabled?: boolean;
};

const CommentButton: FC<OwnProps> = ({
  threadInfo,
  disabled,
}) => {
  const { openChat } = getActions();

  const lang = useLang();
  const {
    threadId, chatId, messagesCount, lastMessageId, lastReadInboxMessageId, recentReplierIds,
  } = threadInfo;

  const handleClick = useCallback(() => {
    openChat({ id: chatId, threadId });
  }, [openChat, chatId, threadId]);

  const recentRepliers = useMemo(() => {
    if (!recentReplierIds?.length) {
      return undefined;
    }

    // No need for expensive global updates on chats and users, so we avoid them
    const { users: { byId: usersById }, chats: { byId: chatsById } } = getGlobal();

    return recentReplierIds.map((peerId) => {
      return isUserId(peerId) ? usersById[peerId] : chatsById[peerId];
    }).filter(Boolean);
  }, [recentReplierIds]);

  if (messagesCount === undefined) {
    return undefined;
  }

  function renderRecentRepliers() {
    return (
      recentRepliers && recentRepliers.length > 0 && (
        <div className="recent-repliers" dir={lang.isRtl ? 'rtl' : 'ltr'}>
          {recentRepliers.map((user) => (
            <Avatar
              key={user.id}
              size="small"
              user={isUserId(user.id) ? user as ApiUser : undefined}
              chat={!isUserId(user.id) ? user as ApiChat : undefined}
            />
          ))}
        </div>
      )
    );
  }

  const hasUnread = Boolean(lastReadInboxMessageId && lastMessageId && lastReadInboxMessageId < lastMessageId);

  return (
    <div
      data-cnt={formatIntegerCompact(messagesCount)}
      className={buildClassName('CommentButton', hasUnread && 'has-unread', disabled && 'disabled')}
      dir={lang.isRtl ? 'rtl' : 'ltr'}
      onClick={handleClick}
    >
      <i className="icon-comments-sticker" />
      {(!recentRepliers || recentRepliers.length === 0) && <i className="icon-comments" />}
      {renderRecentRepliers()}
      <div className="label" dir="auto">
        {messagesCount ? lang('Comments', messagesCount, 'i') : lang('LeaveAComment')}
      </div>
      <i className="icon-next" />
    </div>
  );
};

export default memo(CommentButton);
