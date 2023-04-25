import React, { memo, useMemo } from '../../../lib/teact/teact';

import type { FC } from '../../../lib/teact/teact';
import type { ApiAvailableReaction, ApiMessage, ApiStickerSet } from '../../../api/types';
import type { ActiveReaction } from '../../../global/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';

import { getReactionUniqueKey } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import useLang from '../../../hooks/useLang';

import ReactionButton from './ReactionButton';

import './Reactions.scss';

type OwnProps = {
  message: ApiMessage;
  isOutside?: boolean;
  maxWidth?: number;
  activeReactions?: ActiveReaction[];
  availableReactions?: ApiAvailableReaction[];
  metaChildren?: React.ReactNode;
  genericEffects?: ApiStickerSet;
  observeIntersection?: ObserveFn;
  noRecentReactors?: boolean;
  withEffects?: boolean;
};

const MAX_RECENT_AVATARS = 3;

const Reactions: FC<OwnProps> = ({
  message,
  isOutside,
  maxWidth,
  activeReactions,
  availableReactions,
  metaChildren,
  genericEffects,
  observeIntersection,
  noRecentReactors,
  withEffects,
}) => {
  const lang = useLang();

  const totalCount = useMemo(() => (
    message.reactions!.results.reduce((acc, reaction) => acc + reaction.count, 0)
  ), [message]);

  return (
    <div
      className={buildClassName('Reactions', isOutside && 'is-outside')}
      style={maxWidth ? `max-width: ${maxWidth}px` : undefined}
      dir={lang.isRtl ? 'rtl' : 'ltr'}
    >
      {message.reactions!.results.map((reaction) => (
        <ReactionButton
          key={getReactionUniqueKey(reaction.reaction)}
          reaction={reaction}
          message={message}
          activeReactions={activeReactions}
          availableReactions={availableReactions}
          withRecentReactors={totalCount <= MAX_RECENT_AVATARS && !noRecentReactors}
          genericEffects={genericEffects}
          observeIntersection={observeIntersection}
          withEffects={withEffects}
        />
      ))}
      {metaChildren}
    </div>
  );
};

export default memo(Reactions);
