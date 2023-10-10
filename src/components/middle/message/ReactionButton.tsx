import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type {
  ApiMessage, ApiPeer, ApiReactionCount,
} from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { getMessageKey, isReactionChosen, isSameReaction } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { formatIntegerCompact } from '../../../util/textFormat';
import { REM } from '../../common/helpers/mediaDimensions';

import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedCounter from '../../common/AnimatedCounter';
import AvatarList from '../../common/AvatarList';
import ReactionAnimatedEmoji from '../../common/reactions/ReactionAnimatedEmoji';
import Button from '../../ui/Button';

import './Reactions.scss';

const REACTION_SIZE = 1.25 * REM;

const ReactionButton: FC<{
  reaction: ApiReactionCount;
  message: ApiMessage;
  withRecentReactors?: boolean;
  observeIntersection?: ObserveFn;
}> = ({
  reaction,
  message,
  withRecentReactors,
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
      .filter(Boolean) as ApiPeer[];
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
      className={buildClassName(isReactionChosen(reaction) && 'chosen', 'message-reaction')}
      size="tiny"
      onClick={handleClick}
    >
      <ReactionAnimatedEmoji
        className="reaction-animated-emoji"
        containerId={getMessageKey(message)}
        reaction={reaction.reaction}
        size={REACTION_SIZE}
        observeIntersection={observeIntersection}
      />
      {recentReactors?.length ? (
        <AvatarList size="mini" peers={recentReactors} />
      ) : (
        <AnimatedCounter text={formatIntegerCompact(reaction.count)} className="counter" />
      )}
    </Button>
  );
};

export default memo(ReactionButton);
