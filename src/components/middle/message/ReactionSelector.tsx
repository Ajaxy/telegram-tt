import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo, useRef } from '../../../lib/teact/teact';

import type {
  ApiAvailableReaction, ApiChatReactions, ApiReaction, ApiReactionCount,
} from '../../../api/types';
import type { IAnchorPosition } from '../../../types';

import {
  canSendReaction, getReactionUniqueKey, isSameReaction, sortReactions,
} from '../../../global/helpers';
import buildClassName, { createClassNameBuilder } from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';
import ReactionSelectorCustomReaction from './ReactionSelectorCustomReaction';
import ReactionSelectorReaction from './ReactionSelectorReaction';

import './ReactionSelector.scss';

type OwnProps = {
  enabledReactions?: ApiChatReactions;
  isPrivate?: boolean;
  topReactions?: ApiReaction[];
  allAvailableReactions?: ApiAvailableReaction[];
  currentReactions?: ApiReactionCount[];
  maxUniqueReactions?: number;
  isReady?: boolean;
  canBuyPremium?: boolean;
  isCurrentUserPremium?: boolean;
  canPlayAnimatedEmojis?: boolean;
  className?: string;
  onToggleReaction: (reaction: ApiReaction) => void;
  onShowMore: (position: IAnchorPosition) => void;
};

const cn = createClassNameBuilder('ReactionSelector');
const REACTIONS_AMOUNT = 6;
const FADE_IN_DELAY = 20;

const ReactionSelector: FC<OwnProps> = ({
  allAvailableReactions,
  topReactions,
  enabledReactions,
  currentReactions,
  maxUniqueReactions,
  isPrivate,
  isReady,
  canPlayAnimatedEmojis,
  className,
  onToggleReaction,
  onShowMore,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const lang = useLang();

  const availableReactions = useMemo(() => {
    const reactions = (enabledReactions?.type === 'some' && enabledReactions.allowed)
      || allAvailableReactions?.map((reaction) => reaction.reaction);
    const filteredReactions = reactions?.map((reaction) => {
      const isCustomReaction = 'documentId' in reaction;
      const availableReaction = allAvailableReactions?.find((r) => isSameReaction(r.reaction, reaction));
      if ((!isCustomReaction && !availableReaction) || availableReaction?.isInactive) return undefined;

      if (!isPrivate && (!enabledReactions || !canSendReaction(reaction, enabledReactions))) {
        return undefined;
      }

      if (maxUniqueReactions && currentReactions && currentReactions.length >= maxUniqueReactions
        && !currentReactions.some(({ reaction: currentReaction }) => isSameReaction(reaction, currentReaction))) {
        return undefined;
      }

      return isCustomReaction ? reaction : availableReaction;
    }).filter(Boolean) || [];

    return sortReactions(filteredReactions, topReactions);
  }, [allAvailableReactions, currentReactions, enabledReactions, isPrivate, maxUniqueReactions, topReactions]);

  const reactionsToRender = useMemo(() => {
    // Component can fit one more if we do not need show more button
    return availableReactions.length === REACTIONS_AMOUNT + 1
      ? availableReactions
      : availableReactions.slice(0, REACTIONS_AMOUNT);
  }, [availableReactions]);
  const withMoreButton = reactionsToRender.length < availableReactions.length;

  const userReactionIndexes = useMemo(() => {
    const chosenReactions = currentReactions?.filter(({ chosenOrder }) => chosenOrder !== undefined) || [];
    return new Set(chosenReactions.map(({ reaction }) => (
      reactionsToRender.findIndex((r) => r && isSameReaction('reaction' in r ? r.reaction : r, reaction))
    )));
  }, [currentReactions, reactionsToRender]);

  const handleShowMoreClick = useLastCallback(() => {
    const bound = ref.current?.getBoundingClientRect() || { x: 0, y: 0 };
    onShowMore({
      x: bound.x,
      y: bound.y,
    });
  });

  if (!reactionsToRender.length) return undefined;

  return (
    <div className={buildClassName(cn('&', lang.isRtl && 'isRtl'), className)} ref={ref}>
      <div className={cn('bubble-small', lang.isRtl && 'isRtl')} />
      <div className={cn('items-wrapper')}>
        <div className={cn('bubble-big', lang.isRtl && 'isRtl')} />
        <div className={cn('items')} dir={lang.isRtl ? 'rtl' : undefined}>
          {reactionsToRender.map((reaction, i) => (
            'reaction' in reaction ? (
              <ReactionSelectorReaction
                key={getReactionUniqueKey(reaction.reaction)}
                isReady={isReady}
                onToggleReaction={onToggleReaction}
                reaction={reaction}
                noAppearAnimation={!canPlayAnimatedEmojis}
                chosen={userReactionIndexes.has(i)}
              />
            ) : (
              <ReactionSelectorCustomReaction
                key={getReactionUniqueKey(reaction)}
                isReady={isReady}
                onToggleReaction={onToggleReaction}
                reaction={reaction}
                noAppearAnimation={!canPlayAnimatedEmojis}
                chosen={userReactionIndexes.has(i)}
                style={`--_animation-delay: ${(REACTIONS_AMOUNT - i) * FADE_IN_DELAY}ms`}
              />
            )
          ))}
          {withMoreButton && (
            <Button
              color="translucent"
              className={cn('show-more')}
              onClick={handleShowMoreClick}
            >
              <i className="icon icon-down" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(ReactionSelector);
