import React, { memo, useMemo } from '../../../lib/teact/teact';

import type { FC } from '../../../lib/teact/teact';
import type { ApiAvailableReaction, ApiMessage, ApiStickerSet } from '../../../api/types';
import type { ActiveReaction } from '../../../global/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { getReactionUniqueKey } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';

import ReactionButton from './ReactionButton';

import './Reactions.scss';

type OwnProps = {
  message: ApiMessage;
  isOutside?: boolean;
  activeReactions?: ActiveReaction[];
  availableReactions?: ApiAvailableReaction[];
  metaChildren?: React.ReactNode;
  genericEffects?: ApiStickerSet;
  observeIntersection?: ObserveFn;
};

const MAX_RECENT_AVATARS = 3;

const Reactions: FC<OwnProps> = ({
  message,
  isOutside,
  activeReactions,
  availableReactions,
  metaChildren,
  genericEffects,
  observeIntersection,
}) => {
  const totalCount = useMemo(() => (
    message.reactions!.results.reduce((acc, reaction) => acc + reaction.count, 0)
  ), [message]);

  return (
    <div className={buildClassName('Reactions', isOutside && 'is-outside')}>
      {message.reactions!.results.map((reaction) => (
        <ReactionButton
          key={getReactionUniqueKey(reaction.reaction)}
          reaction={reaction}
          message={message}
          activeReactions={activeReactions}
          availableReactions={availableReactions}
          withRecentReactors={totalCount <= MAX_RECENT_AVATARS}
          genericEffects={genericEffects}
          observeIntersection={observeIntersection}
        />
      ))}
      {metaChildren}
    </div>
  );
};

export default memo(Reactions);
