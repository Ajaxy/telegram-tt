import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useMemo, useRef } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type {
  ApiAvailableReaction, ApiChatReactions, ApiReaction, ApiReactionCount,
} from '../../../../api/types';
import type { IAnchorPosition } from '../../../../types';

import {
  canSendReaction, getReactionKey, isSameReaction, sortReactions,
} from '../../../../global/helpers';
import buildClassName, { createClassNameBuilder } from '../../../../util/buildClassName';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../ui/Button';
import Link from '../../../ui/Link';
import ReactionSelectorCustomReaction from './ReactionSelectorCustomReaction';
import ReactionSelectorReaction from './ReactionSelectorReaction';

import './ReactionSelector.scss';

type OwnProps = {
  enabledReactions?: ApiChatReactions;
  isPrivate?: boolean;
  topReactions?: ApiReaction[];
  defaultTagReactions?: ApiReaction[];
  allAvailableReactions?: ApiAvailableReaction[];
  currentReactions?: ApiReactionCount[];
  maxUniqueReactions?: number;
  isReady?: boolean;
  canBuyPremium?: boolean;
  isCurrentUserPremium?: boolean;
  canPlayAnimatedEmojis?: boolean;
  className?: string;
  isInSavedMessages?: boolean;
  isInStoryViewer?: boolean;
  onClose?: NoneToVoidFunction;
  onToggleReaction: (reaction: ApiReaction) => void;
  onShowMore: (position: IAnchorPosition) => void;
};

const cn = createClassNameBuilder('ReactionSelector');
const REACTIONS_AMOUNT = 7;
const FADE_IN_DELAY = 20;

const ReactionSelector: FC<OwnProps> = ({
  allAvailableReactions,
  topReactions,
  defaultTagReactions,
  enabledReactions,
  currentReactions,
  maxUniqueReactions,
  isPrivate,
  isReady,
  canPlayAnimatedEmojis,
  className,
  isCurrentUserPremium,
  isInSavedMessages,
  isInStoryViewer,
  onClose,
  onToggleReaction,
  onShowMore,
}) => {
  const { openPremiumModal } = getActions();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const lang = useLang();

  const areReactionsLocked = isInSavedMessages && !isCurrentUserPremium && !isInStoryViewer;

  const availableReactions = useMemo(() => {
    const reactions = isInSavedMessages ? defaultTagReactions
      : (enabledReactions?.type === 'some' ? enabledReactions.allowed
        : allAvailableReactions?.map((reaction) => reaction.reaction));
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
  }, [
    allAvailableReactions, currentReactions, defaultTagReactions, enabledReactions, isInSavedMessages, isPrivate,
    maxUniqueReactions, topReactions,
  ]);

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

  const handleOpenPremiumModal = useLastCallback(() => {
    onClose?.();
    openPremiumModal({
      initialSection: 'saved_tags',
    });
  });

  const hintText = useMemo(() => {
    if (isInSavedMessages) {
      if (!isCurrentUserPremium) {
        const text = lang('lng_subscribe_tag_about');
        const parts = text.split('{link}');
        return (
          <span>
            {parts[0]}
            <Link isPrimary onClick={handleOpenPremiumModal}>
              {lang('lng_subscribe_tag_link')}
            </Link>
            {parts[1]}
          </span>
        );
      }

      return lang('SavedTagReactionsHint2');
    }

    if (isInStoryViewer) {
      return lang('StoryReactionsHint');
    }

    return undefined;
  }, [isCurrentUserPremium, isInSavedMessages, isInStoryViewer, lang]);

  if (!reactionsToRender.length) return undefined;

  return (
    <div className={buildClassName(cn('&', lang.isRtl && 'isRtl'), className)} ref={ref}>
      <div className={cn('bubble-small', lang.isRtl && 'isRtl')} />
      <div className={cn('items-wrapper')}>
        <div className={cn('bubble-big', lang.isRtl && 'isRtl')} />
        <div className={cn('items')}>
          {hintText && <div className={cn('hint')}>{hintText}</div>}
          <div className={cn('reactions')} dir={lang.isRtl ? 'rtl' : undefined}>
            {reactionsToRender.map((reaction, i) => (
              'reaction' in reaction ? (
                <ReactionSelectorReaction
                  key={getReactionKey(reaction.reaction)}
                  isReady={isReady}
                  onToggleReaction={onToggleReaction}
                  reaction={reaction}
                  noAppearAnimation={!canPlayAnimatedEmojis}
                  chosen={userReactionIndexes.has(i)}
                  isLocked={areReactionsLocked}
                />
              ) : (
                <ReactionSelectorCustomReaction
                  key={getReactionKey(reaction)}
                  isReady={isReady}
                  onToggleReaction={onToggleReaction}
                  reaction={reaction}
                  noAppearAnimation={!canPlayAnimatedEmojis}
                  chosen={userReactionIndexes.has(i)}
                  isLocked={areReactionsLocked}
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
    </div>
  );
};

export default memo(ReactionSelector);
