import React, { memo, useEffect, useRef } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type {
  ApiPeer, ApiReaction, ApiReactionCount,
} from '../../../../api/types';
import type { GlobalState } from '../../../../global/types';
import type { ObserveFn } from '../../../../hooks/useIntersectionObserver';

import { isReactionChosen } from '../../../../global/helpers';
import buildClassName from '../../../../util/buildClassName';
import { formatIntegerCompact } from '../../../../util/textFormat';
import { REM } from '../../../common/helpers/mediaDimensions';

import useSelector from '../../../../hooks/data/useSelector';
import useContextMenuHandlers from '../../../../hooks/useContextMenuHandlers';
import useEffectWithPrevDeps from '../../../../hooks/useEffectWithPrevDeps';
import useLastCallback from '../../../../hooks/useLastCallback';
import usePrevious from '../../../../hooks/usePrevious';
import useShowTransition from '../../../../hooks/useShowTransition';

import AnimatedCounter from '../../../common/AnimatedCounter';
import AvatarList from '../../../common/AvatarList';
import PaidReactionEmoji from '../../../common/reactions/PaidReactionEmoji';
import ReactionAnimatedEmoji from '../../../common/reactions/ReactionAnimatedEmoji';
import Sparkles from '../../../common/Sparkles';
import Button from '../../../ui/Button';

import styles from './ReactionButton.module.scss';

const REACTION_SIZE = 1.25 * REM;
const MAX_SCALE = 3;

type OwnProps = {
  chatId: string;
  messageId: number;
  reaction: ApiReactionCount;
  containerId: string;
  isOwnMessage?: boolean;
  recentReactors?: ApiPeer[];
  className?: string;
  chosenClassName?: string;
  isOutside?: boolean;
  observeIntersection?: ObserveFn;
  onClick?: (reaction: ApiReaction) => void;
  onPaidClick?: (count: number) => void;
};

function selectStarsState(global: GlobalState) {
  return global.stars;
}

const ReactionButton = ({
  reaction,
  containerId,
  isOwnMessage,
  recentReactors,
  className,
  chosenClassName,
  chatId,
  messageId,
  isOutside,
  observeIntersection,
  onClick,
  onPaidClick,
}: OwnProps) => {
  const {
    openStarsBalanceModal,
    resetLocalPaidReactions,
    openPaidReactionModal,
    requestWave,
  } = getActions();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLButtonElement>(null);
  // eslint-disable-next-line no-null/no-null
  const counterRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<Animation>();

  const isPaid = reaction.reaction.type === 'paid';

  const starsState = useSelector(selectStarsState);
  const areStarsLoaded = Boolean(starsState);

  const handlePaidClick = useLastCallback((count = 1) => {
    onPaidClick?.(count);
  });

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    if (reaction.reaction.type === 'paid') {
      e.stopPropagation(); // Prevent default message double click behavior
      handlePaidClick();

      return;
    }

    onClick?.(reaction.reaction);
  });

  const {
    isContextMenuOpen,
    handleBeforeContextMenu,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(ref, reaction.reaction.type !== 'paid', undefined, undefined, undefined, true);

  useEffect(() => {
    if (isContextMenuOpen) {
      openPaidReactionModal({
        chatId,
        messageId,
      });

      handleContextMenuClose();
      handleContextMenuHide();
    }
  }, [handleContextMenuClose, handleContextMenuHide, isContextMenuOpen, chatId, messageId]);

  useEffectWithPrevDeps(([prevReaction]) => {
    const amount = reaction.localAmount;
    const button = ref.current;
    if (!amount || !button || amount === prevReaction?.localAmount) return;

    if (areStarsLoaded && amount > starsState.balance.amount) {
      openStarsBalanceModal({
        originReaction: {
          chatId,
          messageId,
          amount,
        },
      });
      resetLocalPaidReactions({
        chatId,
        messageId,
      });
      return;
    }

    if (reaction.localAmount) {
      const { left, top } = button.getBoundingClientRect();
      const startX = left + button.offsetWidth / 2;
      const startY = top + button.offsetHeight / 2;
      requestWave({ startX, startY });
    }

    const currentScale = Number(getComputedStyle(button).scale) || 1;
    animationRef.current?.cancel();
    // Animate scaling by 20%, and then returning to 1
    animationRef.current = button.animate([
      { scale: currentScale },
      { scale: Math.min(currentScale * 1.2, MAX_SCALE), offset: 0.2 },
      { scale: 1 },
    ], {
      duration: 500 * currentScale,
      easing: 'ease-out',
    });
  }, [reaction, starsState?.balance, areStarsLoaded, chatId, messageId]);

  const prevAmount = usePrevious(reaction.localAmount);

  const {
    shouldRender: shouldRenderPaidCounter,
  } = useShowTransition({
    isOpen: Boolean(reaction.localAmount),
    ref: counterRef,
    className: 'slow',
    withShouldRender: true,
  });

  return (
    <Button
      className={buildClassName(
        styles.root,
        isOwnMessage && styles.own,
        isPaid && styles.paid,
        isOutside && styles.outside,
        isReactionChosen(reaction) && styles.chosen,
        isReactionChosen(reaction) && chosenClassName,
        className,
      )}
      size="tiny"
      ref={ref}
      onMouseDown={handleBeforeContextMenu}
      onContextMenu={handleContextMenu}
      onClick={handleClick}
    >
      {reaction.reaction.type === 'paid' ? (
        <>
          <Sparkles preset="button" />
          <PaidReactionEmoji
            className={styles.animatedEmoji}
            containerId={containerId}
            reaction={reaction.reaction}
            size={REACTION_SIZE}
            localAmount={reaction.localAmount}
            observeIntersection={observeIntersection}
          />
          {shouldRenderPaidCounter && (
            <AnimatedCounter
              ref={counterRef}
              text={`+${formatIntegerCompact(reaction.localAmount || prevAmount!)}`}
              className={styles.paidCounter}
            />
          )}
        </>
      ) : (
        <ReactionAnimatedEmoji
          className={styles.animatedEmoji}
          containerId={containerId}
          reaction={reaction.reaction}
          size={REACTION_SIZE}
          observeIntersection={observeIntersection}
        />
      )}
      {recentReactors?.length ? (
        <AvatarList size="mini" peers={recentReactors} />
      ) : (
        <AnimatedCounter
          text={formatIntegerCompact(reaction.count + (reaction.localAmount || 0))}
          className={styles.counter}
        />
      )}
    </Button>
  );
};

export default memo(ReactionButton);
