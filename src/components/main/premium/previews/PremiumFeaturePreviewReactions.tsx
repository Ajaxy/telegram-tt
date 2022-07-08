import type { FC } from '../../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { GlobalState } from '../../../../global/types';
import type { ApiAvailableReaction } from '../../../../api/types';

import cycleRestrict from '../../../../util/cycleRestrict';
import useMedia from '../../../../hooks/useMedia';
import useInterval from '../../../../hooks/useInterval';
import useFlag from '../../../../hooks/useFlag';

import AnimatedSticker from '../../../common/AnimatedSticker';

import styles from './PremiumFeaturePreviewReactions.module.scss';

type StateProps = {
  availableReactions: GlobalState['availableReactions'];
};

const EMOJI_SIZE_MULTIPLIER = 0.2;
const EFFECT_SIZE_MULTIPLIER = 0.6;
const ROTATE_INTERVAL = 3000;
const CLICK_DELAY = 4000;
const MAX_EMOJIS = 15;

const AnimatedCircleReaction: FC<{
  size: number;
  realIndex: number;
  reaction: ApiAvailableReaction;
  index: number;
  maxLength: number;
  handleClick: (index: number) => void;
  isActivated: boolean;
}> = ({
  size, realIndex, isActivated,
  reaction, index, maxLength, handleClick,
}) => {
  const mediaData = useMedia(`document${reaction.activateAnimation?.id}`);
  const mediaDataAround = useMedia(`document${reaction.aroundAnimation?.id}`);
  const [isAnimated, animate, inanimate] = useFlag(isActivated);
  const [isEffectEnded, markEffectEnded, unmarkEffectEnded] = useFlag(false);

  const circleSize = (size - size * EMOJI_SIZE_MULTIPLIER) / 2;

  const t = index / maxLength;
  const angle = t * (Math.PI * 2);
  const totalAngle = angle - (Math.PI / 6) * Math.cos(angle);
  const scaleNotFull = 0.2 + (0.7 * (Math.sin(totalAngle) + 1)) / 2;
  const scale = scaleNotFull > 0.85 ? 1 : scaleNotFull;

  const x = Math.cos(totalAngle) * circleSize;
  const y = Math.sin(totalAngle) * circleSize * 0.6;

  const handleClickEmoji = useCallback(() => {
    handleClick(realIndex);
  }, [handleClick, realIndex]);

  useEffect(() => {
    if (isActivated) {
      animate();
      unmarkEffectEnded();
    }
  }, [isActivated, animate, unmarkEffectEnded]);

  return (
    <>
      {isActivated && !isEffectEnded && (
        <AnimatedSticker
          className={styles.effectSticker}
          tgsUrl={mediaDataAround}
          play
          isLowPriority
          noLoop
          size={EFFECT_SIZE_MULTIPLIER * size}
          style={`--x: ${x}px; --y: ${y}px; --scale: ${scale};`}
          onEnded={markEffectEnded}
        />
      )}
      <AnimatedSticker
        className={styles.sticker}
        tgsUrl={mediaData}
        onClick={handleClickEmoji}
        play={isAnimated}
        noLoop
        size={EMOJI_SIZE_MULTIPLIER * size}
        style={`--x: ${x}px; --y: ${y}px; --scale: ${scale};`}
        onEnded={inanimate}
      />
    </>
  );
};
const PremiumFeaturePreviewReactions: FC<StateProps> = ({
  availableReactions,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const [isIntervalPaused, pauseInterval, unpauseInterval] = useFlag();
  const lastUnpauseTimeout = useRef<NodeJS.Timeout>();
  const [offset, setOffset] = useState(0);
  const [size, setSize] = useState(0);

  const renderedReactions = availableReactions?.filter((l) => l.isPremium)?.slice(0, MAX_EMOJIS) || [];

  useInterval(() => {
    setOffset((current) => cycleRestrict(renderedReactions.length, current + 1));
  }, isIntervalPaused ? undefined : ROTATE_INTERVAL);

  const handleClickEmoji = useCallback((i: number) => {
    setOffset(i);
    pauseInterval();
    if (lastUnpauseTimeout.current) clearTimeout(lastUnpauseTimeout.current);
    lastUnpauseTimeout.current = setTimeout(() => {
      unpauseInterval();
    }, CLICK_DELAY);
  }, [pauseInterval, unpauseInterval]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setSize(container.closest('.modal-dialog')!.clientWidth);
  }, []);

  return (
    <div
      className={styles.root}
      ref={containerRef}
    >
      {renderedReactions.map((l, i) => {
        return (
          <AnimatedCircleReaction
            size={size}
            reaction={l}
            realIndex={i}
            index={(i - offset + renderedReactions.length / 4) % renderedReactions.length}
            maxLength={renderedReactions.length}
            handleClick={handleClickEmoji}
            isActivated={offset === i}
          />
        );
      })}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    return {
      availableReactions: global.availableReactions,
    };
  },
)(PremiumFeaturePreviewReactions));
