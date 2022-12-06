import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type {
  ApiAvailableReaction, ApiMessage, ApiReactionCount, ApiUser,
} from '../../../api/types';
import type { ActiveReaction } from '../../../global/types';

import buildClassName from '../../../util/buildClassName';
import { formatIntegerCompact } from '../../../util/textFormat';

import Button from '../../ui/Button';
import Avatar from '../../common/Avatar';
import ReactionAnimatedEmoji from './ReactionAnimatedEmoji';
import AnimatedCounter from '../../common/AnimatedCounter';

import './Reactions.scss';

const MAX_REACTORS_AVATARS = 3;

const ReactionButton: FC<{
  reaction: ApiReactionCount;
  message: ApiMessage;
  activeReaction?: ActiveReaction;
  availableReactions?: ApiAvailableReaction[];
}> = ({
  reaction,
  message,
  activeReaction,
  availableReactions,
}) => {
  const { sendReaction } = getActions();

  const { recentReactions } = message.reactions!;

  const recentReactors = useMemo(() => {
    if (!recentReactions || reaction.count > MAX_REACTORS_AVATARS) {
      return undefined;
    }

    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;

    return recentReactions
      .filter((recentReaction) => recentReaction.reaction === reaction.reaction)
      .map((recentReaction) => usersById[recentReaction.userId])
      .filter(Boolean) as ApiUser[];
  }, [reaction, recentReactions]);

  const handleClick = useCallback(() => {
    sendReaction({
      reaction: reaction.isChosen ? undefined : reaction.reaction,
      chatId: message.chatId,
      messageId: message.id,
    });
  }, [message, reaction, sendReaction]);

  return (
    <Button
      className={buildClassName(reaction.isChosen && 'chosen')}
      size="tiny"
      onClick={handleClick}
    >
      <ReactionAnimatedEmoji
        activeReaction={activeReaction}
        reaction={reaction.reaction}
        availableReactions={availableReactions}
      />
      {recentReactors?.length ? (
        <div className="avatars">
          {recentReactors.map((user) => <Avatar user={user} size="micro" />)}
        </div>
      ) : <AnimatedCounter text={formatIntegerCompact(reaction.count)} />}
    </Button>
  );
};

export default memo(ReactionButton);
