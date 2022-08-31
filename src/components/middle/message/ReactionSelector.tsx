import type { FC } from '../../../lib/teact/teact';
import React, { memo, useLayoutEffect, useRef } from '../../../lib/teact/teact';

import type { ApiAvailableReaction } from '../../../api/types';

import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useFlag from '../../../hooks/useFlag';
import { getTouchY } from '../../../util/scrollLock';
import { createClassNameBuilder } from '../../../util/buildClassName';
import { IS_COMPACT_MENU } from '../../../util/environment';
import { getActions } from '../../../global';

import ReactionSelectorReaction from './ReactionSelectorReaction';
import Button from '../../ui/Button';

import './ReactionSelector.scss';

type OwnProps = {
  enabledReactions?: string[];
  onSendReaction: (reaction: string, x: number, y: number) => void;
  isPrivate?: boolean;
  availableReactions?: ApiAvailableReaction[];
  isReady?: boolean;
  canBuyPremium?: boolean;
  isCurrentUserPremium?: boolean;
};

const cn = createClassNameBuilder('ReactionSelector');

const ReactionSelector: FC<OwnProps> = ({
  availableReactions,
  enabledReactions,
  onSendReaction,
  isPrivate,
  isReady,
  canBuyPremium,
  isCurrentUserPremium,
}) => {
  const { openPremiumModal } = getActions();
  // eslint-disable-next-line no-null/no-null
  const itemsScrollRef = useRef<HTMLDivElement>(null);
  const [isHorizontalScrollEnabled, enableHorizontalScroll] = useFlag(false);
  useHorizontalScroll(itemsScrollRef.current, !isHorizontalScrollEnabled);

  useLayoutEffect(() => {
    enableHorizontalScroll();
  }, [enableHorizontalScroll]);

  const handleWheel = (e: React.WheelEvent | React.TouchEvent) => {
    if (!itemsScrollRef) return;
    const deltaY = 'deltaY' in e ? e.deltaY : getTouchY(e);

    if (deltaY) {
      e.preventDefault();
    }
  };

  if ((!isPrivate && !enabledReactions?.length) || !availableReactions) return undefined;

  return (
    <div className={cn('&', IS_COMPACT_MENU && 'compact')} onWheelCapture={handleWheel} onTouchMove={handleWheel}>
      <div className={cn('bubble-big')} />
      <div className={cn('bubble-small')} />
      <div className={cn('items-wrapper')}>
        <div className={cn('items', ['no-scrollbar'])} ref={itemsScrollRef}>
          {availableReactions?.map((reaction, i) => {
            if (reaction.isInactive || (reaction.isPremium && !isCurrentUserPremium)
              || (!isPrivate && (!enabledReactions || !enabledReactions.includes(reaction.reaction)))) return undefined;
            return (
              <ReactionSelectorReaction
                key={reaction.reaction}
                previewIndex={i}
                isReady={isReady}
                onSendReaction={onSendReaction}
                reaction={reaction}
                isCurrentUserPremium={isCurrentUserPremium}
              />
            );
          })}
          {canBuyPremium && Boolean(
            availableReactions
              .filter((r) => r.isPremium && (!enabledReactions || enabledReactions.includes(r.reaction)))
              .length,
          ) && (
            <Button
              round
              color="translucent"
              className={cn('blocked-button')}
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => openPremiumModal({
                initialSection: 'unique_reactions',
              })}
            >
              <i className="icon-lock-badge" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(ReactionSelector);
