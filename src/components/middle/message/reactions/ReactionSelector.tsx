import type { FC } from '../../../../lib/teact/teact';
import { memo, useMemo, useRef } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type {
  ApiAvailableReaction,
  ApiChatReactions,
  ApiReaction,
  ApiReactionCount,
  ApiReactionCustomEmoji,
  ApiReactionPaid,
} from '../../../../api/types';
import type { IAnchorPosition } from '../../../../types';

import {
  canSendReaction, getReactionKey, isSameReaction, sortReactions,
} from '../../../../global/helpers';
import buildClassName, { createClassNameBuilder } from '../../../../util/buildClassName';

import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';

import Button from '../../../ui/Button';
import Link from '../../../ui/Link';
import ReactionSelectorCustomReaction from './ReactionSelectorCustomReaction';
import ReactionSelectorReaction from './ReactionSelectorReaction';

import './ReactionSelector.scss';

type RenderableReactions = (ApiAvailableReaction | ApiReactionCustomEmoji | ApiReactionPaid)[];

type OwnProps = {
  enabledReactions?: ApiChatReactions;
  isPrivate?: boolean;
  topReactions?: ApiReaction[];
  defaultTagReactions?: ApiReaction[];
  effectReactions?: ApiReaction[];
  allAvailableReactions?: ApiAvailableReaction[];
  currentReactions?: ApiReactionCount[];
  reactionsLimit?: number;
  isReady?: boolean;
  canBuyPremium?: boolean;
  isCurrentUserPremium?: boolean;
  canPlayAnimatedEmojis?: boolean;
  className?: string;
  isInSavedMessages?: boolean;
  isInStoryViewer?: boolean;
  isForEffects?: boolean;
  isWithPaidReaction?: boolean;
  onClose?: NoneToVoidFunction;
  onToggleReaction: (reaction: ApiReaction) => void;
  onSendPaidReaction?: NoneToVoidFunction;
  onShowPaidReactionModal?: NoneToVoidFunction;
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
  reactionsLimit,
  isPrivate,
  isReady,
  canPlayAnimatedEmojis,
  className,
  isCurrentUserPremium,
  isInSavedMessages,
  isInStoryViewer,
  isForEffects,
  effectReactions,
  isWithPaidReaction,
  onClose,
  onToggleReaction,
  onSendPaidReaction,
  onShowPaidReactionModal,
  onShowMore,
}) => {
  const { openPremiumModal } = getActions();
  const ref = useRef<HTMLDivElement>();
  const lang = useOldLang();

  const areReactionsLocked = isInSavedMessages && !isCurrentUserPremium && !isInStoryViewer;

  const shouldUseCurrentReactions = Boolean(reactionsLimit
    && currentReactions && currentReactions.length >= reactionsLimit);

  const availableReactions = useMemo(() => {
    const reactions = (() => {
      if (shouldUseCurrentReactions) return currentReactions?.map((reaction) => reaction.reaction);
      if (isForEffects) return effectReactions;
      if (isInSavedMessages) return defaultTagReactions;
      if (enabledReactions?.type === 'some') return enabledReactions.allowed;
      return allAvailableReactions?.map((reaction) => reaction.reaction);
    })();

    const filteredReactions: RenderableReactions = reactions?.map((reaction) => {
      const isCustomReaction = reaction.type === 'custom';
      const availableReaction = allAvailableReactions?.find((r) => isSameReaction(r.reaction, reaction));

      if (isForEffects) return availableReaction;

      if ((!isCustomReaction && !availableReaction) || availableReaction?.isInactive) return undefined;

      if (!isPrivate && !shouldUseCurrentReactions
        && (!enabledReactions || !canSendReaction(reaction, enabledReactions))) {
        return undefined;
      }

      return isCustomReaction ? reaction : availableReaction;
    }).filter(Boolean) || [];

    const sortedReactions = sortReactions(filteredReactions, topReactions);
    if (isWithPaidReaction) {
      sortedReactions.unshift({ type: 'paid' });
    }
    return sortedReactions;
  }, [
    allAvailableReactions, currentReactions, defaultTagReactions, enabledReactions, isInSavedMessages, isPrivate,
    topReactions, isForEffects, effectReactions, shouldUseCurrentReactions, isWithPaidReaction,
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

    if (isForEffects) {
      return lang('AddEffectMessageHint');
    }

    return undefined;
  }, [isCurrentUserPremium, isInSavedMessages, isInStoryViewer, lang, isForEffects]);

  if (!reactionsToRender.length) return undefined;

  return (
    <div className={buildClassName(cn('&'), className)} ref={ref}>
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
                  onSendPaidReaction={onSendPaidReaction}
                  onShowPaidReactionModal={onShowPaidReactionModal}
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
                iconName="down"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(ReactionSelector);
