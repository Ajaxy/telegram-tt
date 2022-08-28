import type { FC } from '../../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { GlobalState } from '../../../../global/types';
import type { ApiSticker } from '../../../../api/types';

import cycleRestrict from '../../../../util/cycleRestrict';
import useMedia from '../../../../hooks/useMedia';
import useFlag from '../../../../hooks/useFlag';

import AnimatedSticker from '../../../common/AnimatedSticker';

import styles from './PremiumFeaturePreviewStickers.module.scss';

type OwnProps = {
  isActive: boolean;
};

type StateProps = {
  stickers: GlobalState['stickers']['premium']['stickers'];
};

const EMOJI_SIZE_MULTIPLIER = 0.6;
const EFFECT_SIZE_MULTIPLIER = 0.8;
const MAX_EMOJIS = 15;
const ENDED_DELAY = 150;

const AnimatedCircleSticker: FC<{
  size: number;
  realIndex: number;
  sticker: ApiSticker;
  index: number;
  maxLength: number;
  onClick: (index: number) => void;
  onEnded: NoneToVoidFunction;
  canPlay: boolean;
}> = ({
  size, realIndex, canPlay,
  sticker, index, maxLength, onClick, onEnded,
}) => {
  const mediaData = useMedia(`sticker${sticker.id}`);
  const mediaDataAround = useMedia(`sticker${sticker.id}?size=f`);

  const isActivated = index === 0;
  const [isAnimated, animate, inanimate] = useFlag(isActivated);

  const circleSize = size - size * EMOJI_SIZE_MULTIPLIER;
  const width = circleSize * 3;
  const height = circleSize * 3.2;

  const a = index / maxLength;

  const angle = a * (Math.PI * 2);
  const scale = isActivated ? 1 : 0.66;

  const x = Math.cos(angle) * width - circleSize * 2.8;
  const y = Math.sin(angle) * height;

  const handleClick = useCallback(() => {
    onClick(realIndex);
  }, [onClick, realIndex]);

  const handleEnded = useCallback(() => {
    inanimate();
    onEnded();
  }, [inanimate, onEnded]);

  useEffect(() => {
    if (isActivated) {
      animate();
    }
  }, [isActivated, animate]);

  return (
    <>
      {isActivated && (
        <AnimatedSticker
          className={styles.effectSticker}
          tgsUrl={mediaDataAround}
          play={canPlay}
          isLowPriority
          noLoop
          size={EFFECT_SIZE_MULTIPLIER * size}
          style={`--x: calc(${x}px - 10%); --y: ${y}px;`}
        />
      )}
      <AnimatedSticker
        className={styles.sticker}
        tgsUrl={mediaData}
        play={canPlay && isAnimated}
        noLoop
        size={EMOJI_SIZE_MULTIPLIER * size}
        style={`--x: ${x}px; --y: ${y}px; --opacity: ${scale}`}
        onClick={handleClick}
        onEnded={handleEnded}
      />
    </>
  );
};
const PremiumFeaturePreviewStickers: FC<OwnProps & StateProps> = ({
  stickers, isActive,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [size, setSize] = useState(0);

  const renderedStickers = stickers?.slice(0, MAX_EMOJIS);

  const handleClick = useCallback((i: number) => {
    setOffset(-i);
  }, []);

  const handleEnded = useCallback(() => {
    setTimeout(() => {
      setOffset((current) => cycleRestrict(renderedStickers.length, current + 1));
    }, ENDED_DELAY);
  }, [renderedStickers.length]);

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
      {renderedStickers?.map((l, i) => {
        return (
          <AnimatedCircleSticker
            size={size}
            sticker={l}
            realIndex={i}
            index={(i + offset + renderedStickers.length) % renderedStickers.length}
            maxLength={renderedStickers.length}
            onClick={handleClick}
            onEnded={handleEnded}
            canPlay={isActive}
          />
        );
      })}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      stickers: global.stickers.premium.stickers,
    };
  },
)(PremiumFeaturePreviewStickers));
