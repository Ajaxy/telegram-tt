import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type {
  ApiAvailableReaction, ApiChat, ApiMessage, ApiReactionCount, ApiStickerSet, ApiUser,
} from '../../../api/types';
import type { ActiveReaction } from '../../../global/types';

import buildClassName from '../../../util/buildClassName';
import { formatIntegerCompact } from '../../../util/textFormat';
import { isSameReaction, isReactionChosen } from '../../../global/helpers';

import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import AvatarList from '../../common/AvatarList';
import ReactionAnimatedEmoji from './ReactionAnimatedEmoji';
import AnimatedCounter from '../../common/AnimatedCounter';

import './Reactions.scss';

const ReactionButton: FC<{
  reaction: ApiReactionCount;
  message: ApiMessage;
  activeReactions?: ActiveReaction[];
  availableReactions?: ApiAvailableReaction[];
  withRecentReactors?: boolean;
  withEffects?: boolean;
  genericEffects?: ApiStickerSet;
  observeIntersection?: ObserveFn;
}> = ({
  reaction,
  message,
  activeReactions,
  availableReactions,
  withRecentReactors,
  withEffects,
  genericEffects,
  observeIntersection,
}) => {
  const { toggleReaction } = getActions();
  const { recentReactions } = message.reactions!;

  const recentReactors = useMemo(() => {
    if (!withRecentReactors || !recentReactions) {
      return undefined;
    }

    // No need for expensive global updates on chats or users, so we avoid them
    const chatsById = getGlobal().chats.byId;
    const usersById = getGlobal().users.byId;

    return recentReactions
      .filter((recentReaction) => isSameReaction(recentReaction.reaction, reaction.reaction))
      .map((recentReaction) => usersById[recentReaction.peerId] || chatsById[recentReaction.peerId])
      .filter(Boolean) as (ApiChat | ApiUser)[];
  }, [reaction.reaction, recentReactions, withRecentReactors]);

  const handleClick = useLastCallback(() => {
    toggleReaction({
      reaction: reaction.reaction,
      chatId: message.chatId,
      messageId: message.id,
    });
  });

  return (
    <Button
      className={buildClassName(isReactionChosen(reaction) && 'chosen')}
      size="tiny"
      onClick={handleClick}
    >
      <ReactionAnimatedEmoji
        activeReactions={activeReactions}
        reaction={reaction.reaction}
        availableReactions={availableReactions}
        genericEffects={genericEffects}
        observeIntersection={observeIntersection}
        withEffects={withEffects}
      />
      {recentReactors?.length ? (
        <AvatarList size="mini" peers={recentReactors} />
      ) : <AnimatedCounter text={formatIntegerCompact(reaction.count)} className="counter" />}
    </Button>
  );
};

export default memo(ReactionButton);
