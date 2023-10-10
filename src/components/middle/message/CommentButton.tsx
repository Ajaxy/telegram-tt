import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type {
  ApiThreadInfo,
} from '../../../api/types';

import { selectPeer } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatIntegerCompact } from '../../../util/textFormat';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedCounter from '../../common/AnimatedCounter';
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
  const { openComments } = getActions();

  const lang = useLang();
  const {
    threadId, chatId, messagesCount, lastMessageId, lastReadInboxMessageId, recentReplierIds, originChannelId,
  } = threadInfo;

  const handleClick = useLastCallback(() => {
    openComments({ id: chatId, threadId, originChannelId });
  });

  const recentRepliers = useMemo(() => {
    if (!recentReplierIds?.length) {
      return undefined;
    }

    // No need for expensive global updates on chats and users, so we avoid them
    const global = getGlobal();

    return recentReplierIds.map((peerId) => {
      return selectPeer(global, peerId);
    }).filter(Boolean);
  }, [recentReplierIds]);

  if (messagesCount === undefined) {
    return undefined;
  }

  function renderRecentRepliers() {
    return (
      Boolean(recentRepliers?.length) && (
        <div className="recent-repliers" dir={lang.isRtl ? 'rtl' : 'ltr'}>
          {recentRepliers!.map((peer) => (
            <Avatar
              key={peer.id}
              size="small"
              peer={peer}
            />
          ))}
        </div>
      )
    );
  }

  const hasUnread = Boolean(lastReadInboxMessageId && lastMessageId && lastReadInboxMessageId < lastMessageId);

  const commentsText = messagesCount ? (lang('Comments', '%COMMENTS_COUNT%', undefined, messagesCount) as string)
    .split('%')
    .map((s) => {
      return (s === 'COMMENTS_COUNT' ? <AnimatedCounter text={formatIntegerCompact(messagesCount)} /> : s);
    })
    : undefined;

  return (
    <div
      data-cnt={formatIntegerCompact(messagesCount)}
      className={buildClassName('CommentButton', hasUnread && 'has-unread', disabled && 'disabled')}
      dir={lang.isRtl ? 'rtl' : 'ltr'}
      onClick={handleClick}
    >
      <i className="icon icon-comments-sticker" />
      {(!recentRepliers || recentRepliers.length === 0) && <i className="icon icon-comments" />}
      {renderRecentRepliers()}
      <div className="label" dir="auto">
        {messagesCount ? commentsText : lang('LeaveAComment')}
      </div>
      <i className="icon icon-next" />
    </div>
  );
};

export default memo(CommentButton);
