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
import ReactionSelectorReaction from './ReactionSelectorReaction';

import './ReactionSelector.scss';

type OwnProps = {
  enabledReactions?: ApiChatReactions;
  onToggleReaction: (reaction: ApiReaction) => void;
  isPrivate?: boolean;
  topReactions?: ApiReaction[];
  allAvailableReactions?: ApiAvailableReaction[];
  currentReactions?: ApiReactionCount[];
  maxUniqueReactions?: number;
  isReady?: boolean;
  canBuyPremium?: boolean;
  isCurrentUserPremium?: boolean;
  canPlayAnimatedEmojis?: boolean;
  onShowMore: (position: IAnchorPosition) => void;
  className?: string;
};

const cn = createClassNameBuilder('ReactionSelector');
const REACTIONS_AMOUNT = 6;

const ReactionSelector: FC<OwnProps> = ({
  allAvailableReactions,
  topReactions,
  enabledReactions,
  currentReactions,
  maxUniqueReactions,
  isPrivate,
  isReady,
  canPlayAnimatedEmojis,
  onToggleReaction,
  onShowMore,
  className,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const lang = useLang();

  const availableReactions = useMemo(() => {
    const reactions = allAvailableReactions?.map((availableReaction) => {
      if (availableReaction.isInactive) return undefined;
      if (!isPrivate && (!enabledReactions || !canSendReaction(availableReaction.reaction, enabledReactions))) {
        return undefined;
      }
      if (maxUniqueReactions && currentReactions && currentReactions.length >= maxUniqueReactions
        && !currentReactions.some(({ reaction }) => isSameReaction(reaction, availableReaction.reaction))) {
        return undefined;
      }
      return availableReaction;
    }).filter(Boolean) || [];

    return sortReactions(reactions, topReactions);
  }, [allAvailableReactions, currentReactions, enabledReactions, isPrivate, maxUniqueReactions, topReactions]);

  const reactionsToRender = useMemo(() => {
    return availableReactions.length === REACTIONS_AMOUNT + 1
      ? availableReactions
      : availableReactions.slice(0, REACTIONS_AMOUNT);
  }, [availableReactions]);
  const withMoreButton = reactionsToRender.length < availableReactions.length;

  const userReactionIndexes = useMemo(() => {
    const chosenReactions = currentReactions?.filter(({ chosenOrder }) => chosenOrder !== undefined) || [];
    return new Set(chosenReactions.map(({ reaction }) => (
      reactionsToRender.findIndex((r) => r && isSameReaction(r.reaction, reaction))
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
            <ReactionSelectorReaction
              key={getReactionUniqueKey(reaction.reaction)}
              isReady={isReady}
              onToggleReaction={onToggleReaction}
              reaction={reaction}
              noAppearAnimation={!canPlayAnimatedEmojis}
              chosen={userReactionIndexes.has(i)}
            />
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
