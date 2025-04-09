import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useEffect, useMemo } from '../../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../../global';

import type {
  ApiMessage,
  ApiPeer,
  ApiReaction,
  ApiReactionKey,
  ApiSavedReactionTag,
} from '../../../../api/types';
import type { ObserveFn } from '../../../../hooks/useIntersectionObserver';
import type { ThreadId } from '../../../../types';

import { getReactionKey, isReactionChosen } from '../../../../global/helpers';
import { selectPeer } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { getMessageKey } from '../../../../util/keys/messageKey';

import useEffectOnce from '../../../../hooks/useEffectOnce';
import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';

import ReactionButton from './ReactionButton';
import SavedTagButton from './SavedTagButton';

import './Reactions.scss';

type OwnProps = {
  message: ApiMessage;
  threadId?: ThreadId;
  isOutside?: boolean;
  maxWidth?: number;
  metaChildren?: React.ReactNode;
  tags?: Record<ApiReactionKey, ApiSavedReactionTag>;
  isCurrentUserPremium?: boolean;
  observeIntersection?: ObserveFn;
  noRecentReactors?: boolean;
};

const MAX_RECENT_AVATARS = 3;
const PAID_SEND_DELAY = 5000;

const Reactions: FC<OwnProps> = ({
  message,
  threadId,
  isOutside,
  maxWidth,
  metaChildren,
  observeIntersection,
  noRecentReactors,
  isCurrentUserPremium,
  tags,
}) => {
  const {
    toggleReaction,
    addLocalPaidReaction,
    updateMiddleSearch,
    performMiddleSearch,
    openPremiumModal,
    resetLocalPaidReactions,
    showNotification,
  } = getActions();
  const lang = useOldLang();

  const { results, areTags, recentReactions } = message.reactions!;
  const withServiceReactions = Boolean(message.areReactionsPossible && message.reactions);

  const totalCount = useMemo(() => (
    results.reduce((acc, reaction) => acc + reaction.count, 0)
  ), [results]);

  const recentReactorsByReactionKey = useMemo(() => {
    const global = getGlobal();

    return recentReactions?.reduce((acc, recentReaction) => {
      const { reaction, peerId } = recentReaction;
      const key = getReactionKey(reaction);
      const peer = selectPeer(global, peerId);

      if (!peer) return acc;

      const peers = acc[key] || [];
      peers.push(peer);
      acc[key] = peers;
      return acc;
    }, {} as Record<ApiReactionKey, ApiPeer[]>);
  }, [recentReactions]);

  const props = useMemo(() => {
    const messageKey = getMessageKey(message);
    return results.map((reaction) => {
      const reactionKey = getReactionKey(reaction.reaction);
      const recentReactors = recentReactorsByReactionKey?.[reactionKey];
      const shouldHideRecentReactors = totalCount > MAX_RECENT_AVATARS || noRecentReactors;
      const tag = areTags ? tags?.[reactionKey] : undefined;

      return {
        reaction,
        reactionKey,
        messageKey,
        recentReactors: !shouldHideRecentReactors ? recentReactors : undefined,
        isChosen: isReactionChosen(reaction),
        tag,
      };
    });
  }, [message, noRecentReactors, recentReactorsByReactionKey, results, areTags, tags, totalCount]);

  const handleClick = useLastCallback((reaction: ApiReaction) => {
    if (areTags) {
      if (!isCurrentUserPremium) {
        openPremiumModal({
          initialSection: 'saved_tags',
        });
        return;
      }

      updateMiddleSearch({ chatId: message.chatId, threadId, update: { savedTag: reaction } });
      performMiddleSearch({ chatId: message.chatId, threadId });
      return;
    }

    toggleReaction({
      chatId: message.chatId,
      messageId: message.id,
      reaction,
    });
  });

  const paidLocalCount = useMemo(() => results.find((r) => r.reaction.type === 'paid')?.localAmount || 0, [results]);

  const handlePaidClick = useLastCallback((count: number) => {
    addLocalPaidReaction({
      chatId: message.chatId,
      messageId: message.id,
      count,
    });
  });

  useEffect(() => {
    if (!paidLocalCount) return;

    showNotification({
      localId: getMessageKey(message),
      title: lang('StarsSentTitle'),
      message: lang('StarsSentText', paidLocalCount),
      actionText: lang('StarsSentUndo'),
      cacheBreaker: paidLocalCount.toString(),
      action: {
        action: 'resetLocalPaidReactions',
        payload: { chatId: message.chatId, messageId: message.id },
      },
      dismissAction: {
        action: 'sendPaidReaction',
        payload: { chatId: message.chatId, messageId: message.id },
      },
      duration: PAID_SEND_DELAY,
      shouldShowTimer: true,
      disableClickDismiss: true,
      icon: 'star',
    });
  }, [lang, message, paidLocalCount]);

  const handleRemoveReaction = useLastCallback((reaction: ApiReaction) => {
    toggleReaction({
      chatId: message.chatId,
      messageId: message.id,
      reaction,
    });
  });

  // Reset paid reactions on unmount
  useEffectOnce(() => () => {
    resetLocalPaidReactions({
      chatId: message.chatId,
      messageId: message.id,
    });
  });

  return (
    <div
      className={buildClassName(
        'Reactions',
        isOutside && 'is-outside',
        withServiceReactions && 'is-service',
      )}
      style={maxWidth ? `max-width: ${maxWidth}px` : undefined}
      dir={lang.isRtl ? 'rtl' : 'ltr'}
    >
      {props.map(({
        reaction, recentReactors, messageKey, reactionKey, isChosen, tag,
      }) => (
        areTags ? (
          <SavedTagButton
            key={reactionKey}
            className="message-reaction"
            chosenClassName="chosen"
            containerId={messageKey}
            isOwnMessage={message.isOutgoing}
            isChosen={isChosen}
            reaction={reaction.reaction as ApiReaction}
            tag={tag}
            withContextMenu={isCurrentUserPremium}
            onClick={handleClick}
            onRemove={handleRemoveReaction}
            observeIntersection={observeIntersection}
          />
        ) : (
          <ReactionButton
            key={reactionKey}
            chatId={message.chatId}
            messageId={message.id}
            className="message-reaction"
            chosenClassName="chosen"
            containerId={messageKey}
            isOwnMessage={message.isOutgoing}
            recentReactors={recentReactors}
            isOutside={isOutside}
            reaction={reaction}
            onClick={handleClick}
            onPaidClick={handlePaidClick}
            observeIntersection={observeIntersection}
          />
        )
      ))}
      {metaChildren}
    </div>
  );
};

export default memo(Reactions);
