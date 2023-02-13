import React, {
  memo, useMemo, useRef,
} from '../../../lib/teact/teact';

import type { FC } from '../../../lib/teact/teact';
import type {
  ApiAvailableReaction, ApiChatReactions, ApiReaction, ApiReactionCount,
} from '../../../api/types';

import { getTouchY } from '../../../util/scrollLock';
import { createClassNameBuilder } from '../../../util/buildClassName';
import { IS_COMPACT_MENU } from '../../../util/environment';
import { isSameReaction, canSendReaction, getReactionUniqueKey } from '../../../global/helpers';

import useHorizontalScroll from '../../../hooks/useHorizontalScroll';

import ReactionSelectorReaction from './ReactionSelectorReaction';

import './ReactionSelector.scss';

type OwnProps = {
  enabledReactions?: ApiChatReactions;
  onToggleReaction: (reaction: ApiReaction) => void;
  isPrivate?: boolean;
  availableReactions?: ApiAvailableReaction[];
  currentReactions?: ApiReactionCount[];
  maxUniqueReactions?: number;
  isReady?: boolean;
  canBuyPremium?: boolean;
  isCurrentUserPremium?: boolean;
};

const cn = createClassNameBuilder('ReactionSelector');

const ReactionSelector: FC<OwnProps> = ({
  availableReactions,
  enabledReactions,
  currentReactions,
  maxUniqueReactions,
  isPrivate,
  isReady,
  onToggleReaction,
}) => {
  // eslint-disable-next-line no-null/no-null
  const itemsScrollRef = useRef<HTMLDivElement>(null);
  useHorizontalScroll(itemsScrollRef);

  const handleWheel = (e: React.WheelEvent | React.TouchEvent) => {
    const deltaY = 'deltaY' in e ? e.deltaY : getTouchY(e);

    if (deltaY && e.cancelable) {
      e.preventDefault();
    }
  };

  const reactionsToRender = useMemo(() => {
    return availableReactions?.map((availableReaction) => {
      if (availableReaction.isInactive) return undefined;
      if (!isPrivate && (!enabledReactions || !canSendReaction(availableReaction.reaction, enabledReactions))) {
        return undefined;
      }
      if (maxUniqueReactions && currentReactions && currentReactions.length >= maxUniqueReactions
        && !currentReactions.some(({ reaction }) => isSameReaction(reaction, availableReaction.reaction))) {
        return undefined;
      }
      return availableReaction;
    }) || [];
  }, [availableReactions, currentReactions, enabledReactions, isPrivate, maxUniqueReactions]);

  const userReactionIndexes = useMemo(() => {
    const chosenReactions = currentReactions?.filter(({ chosenOrder }) => chosenOrder !== undefined) || [];
    return new Set(chosenReactions.map(({ reaction }) => (
      reactionsToRender.findIndex((r) => r && isSameReaction(r.reaction, reaction))
    )));
  }, [currentReactions, reactionsToRender]);

  if (!reactionsToRender.length) return undefined;

  return (
    <div className={cn('&', IS_COMPACT_MENU && 'compact')} onWheelCapture={handleWheel} onTouchMove={handleWheel}>
      <div className={cn('bubble-big')} />
      <div className={cn('bubble-small')} />
      <div className={cn('items-wrapper')}>
        <div className={cn('items', ['no-scrollbar'])} ref={itemsScrollRef}>
          {reactionsToRender.map((reaction, i) => {
            if (!reaction) return undefined;
            return (
              <ReactionSelectorReaction
                key={getReactionUniqueKey(reaction.reaction)}
                previewIndex={i}
                isReady={isReady}
                onToggleReaction={onToggleReaction}
                reaction={reaction}
                chosen={userReactionIndexes.has(i)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default memo(ReactionSelector);
