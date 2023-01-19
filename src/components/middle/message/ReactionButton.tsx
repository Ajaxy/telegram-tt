import React, { memo, useCallback, useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type {
  ApiAvailableReaction, ApiMessage, ApiReactionCount, ApiStickerSet, ApiUser,
} from '../../../api/types';
import type { ActiveReaction } from '../../../global/types';

import buildClassName from '../../../util/buildClassName';
import { formatIntegerCompact } from '../../../util/textFormat';
import { isSameReaction, isReactionChosen } from '../../../global/helpers';

import Button from '../../ui/Button';
import Avatar from '../../common/Avatar';
import ReactionAnimatedEmoji from './ReactionAnimatedEmoji';
import AnimatedCounter from '../../common/AnimatedCounter';

import './Reactions.scss';

const ReactionButton: FC<{
  reaction: ApiReactionCount;
  message: ApiMessage;
  activeReactions?: ActiveReaction[];
  availableReactions?: ApiAvailableReaction[];
  withRecentReactors?: boolean;
  genericEffects?: ApiStickerSet;
  observeIntersection?: ObserveFn;
  hideAvatars?: boolean;
}> = ({
  reaction,
  message,
  activeReactions,
  availableReactions,
  withRecentReactors,
  genericEffects,
  observeIntersection,
  hideAvatars,
}) => {
  const { toggleReaction } = getActions();
  const { recentReactions } = message.reactions!;

  const recentReactors = useMemo(() => {
    if (!withRecentReactors || !recentReactions) {
      return undefined;
    }

    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;

    return recentReactions
      .filter((recentReaction) => isSameReaction(recentReaction.reaction, reaction.reaction))
      .map((recentReaction) => usersById[recentReaction.userId])
      .filter(Boolean) as ApiUser[];
  }, [reaction.reaction, recentReactions, withRecentReactors]);

  const handleClick = useCallback(() => {
    toggleReaction({
      reaction: reaction.reaction,
      chatId: message.chatId,
      messageId: message.id,
    });
  }, [message, reaction, toggleReaction]);

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
      />
      {recentReactors?.length && !hideAvatars ? (
        <div className="avatars">
          {recentReactors.map((user) => <Avatar user={user} size="micro" />)}
        </div>
      ) : <AnimatedCounter text={formatIntegerCompact(reaction.count)} />}
    </Button>
  );
};

export default memo(ReactionButton);
