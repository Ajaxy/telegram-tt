import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { ApiCommentsInfo } from '../../../api/types';

import { selectPeer } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatIntegerCompact } from '../../../util/textFormat';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import AnimatedCounter from '../../common/AnimatedCounter';
import Avatar from '../../common/Avatar';
import Spinner from '../../ui/Spinner';

import './CommentButton.scss';

type OwnProps = {
  threadInfo: ApiCommentsInfo;
  disabled?: boolean;
  isLoading?: boolean;
  isCustomShape?: boolean;
};

const SHOW_LOADER_DELAY = 450;

const CommentButton: FC<OwnProps> = ({
  isCustomShape,
  threadInfo,
  disabled,
  isLoading,
}) => {
  const { openThread } = getActions();

  const shouldRenderLoading = useAsyncRendering([isLoading], SHOW_LOADER_DELAY);

  const lang = useLang();
  const {
    originMessageId, chatId, messagesCount, lastMessageId, lastReadInboxMessageId, recentReplierIds, originChannelId,
  } = threadInfo;

  const handleClick = useLastCallback(() => {
    openThread({
      isComments: true, chatId, originMessageId, originChannelId,
    });
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

  const commentsText = messagesCount ? (lang('CommentsCount', '%COMMENTS_COUNT%', undefined, messagesCount) as string)
    .split('%')
    .map((s) => {
      return (s === 'COMMENTS_COUNT' ? <AnimatedCounter text={formatIntegerCompact(messagesCount)} /> : s);
    })
    : undefined;

  return (
    <div
      data-cnt={formatIntegerCompact(messagesCount)}
      className={buildClassName(
        'CommentButton',
        hasUnread && 'has-unread',
        disabled && 'disabled',
        isCustomShape && 'CommentButton-custom-shape',
        isLoading && 'loading',
      )}
      dir={lang.isRtl ? 'rtl' : 'ltr'}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <i
        className={buildClassName(
          'CommentButton_icon-comments icon icon-comments-sticker',
          isLoading && shouldRenderLoading && 'CommentButton_hidden',
        )}
        aria-hidden
      />
      {!recentRepliers?.length && <i className="icon icon-comments" aria-hidden />}
      {renderRecentRepliers()}
      <div className="label" dir="auto">
        {messagesCount ? commentsText : lang('LeaveAComment')}
      </div>
      <div className="CommentButton_right">
        {isLoading && (
          <Spinner
            className={buildClassName(
              'CommentButton_loading',
              !shouldRenderLoading && 'CommentButton_hidden',
            )}
            color={isCustomShape ? 'white' : 'blue'}
          />
        ) }
        <i
          className={buildClassName(
            'CommentButton_icon-open icon icon-next',
            isLoading && shouldRenderLoading && 'CommentButton_hidden',
          )}
          aria-hidden
        />
      </div>
    </div>
  );
};

export default memo(CommentButton);
