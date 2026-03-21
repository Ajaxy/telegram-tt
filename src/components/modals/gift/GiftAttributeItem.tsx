import type { ElementRef, TeactNode } from '@teact';
import { memo, useMemo, useRef } from '@teact';

import type {
  ApiStarGiftAttributeBackdrop,
  ApiStarGiftAttributeRarity,
  ApiSticker,
} from '../../../api/types';

import buildClassName from '../../../util/buildClassName';

import useDynamicColorListener from '../../../hooks/stickers/useDynamicColorListener';
import { type ObserveFn } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';

import GiftRarityBadge from '../../common/GiftRarityBadge';
import RadialPatternBackground from '../../common/profile/RadialPatternBackground';
import StickerView from '../../common/StickerView';

import styles from './GiftAttributeItem.module.scss';

type OwnProps<T> = {
  ref?: ElementRef<HTMLDivElement>;
  children?: TeactNode;
  backdrop?: ApiStarGiftAttributeBackdrop;
  patternSticker?: ApiSticker;
  sticker?: ApiSticker;
  stickerSize?: number;
  stickerNoPlay?: boolean;
  rarity?: ApiStarGiftAttributeRarity;
  isSelected?: boolean;
  className?: string;
  clickArg?: T;
  observeIntersection?: ObserveFn;
  onClick?: (arg: T) => void;
};

const DEFAULT_STICKER_SIZE = 90;

const GiftAttributeItem = <T,>({
  ref,
  backdrop,
  patternSticker,
  sticker,
  stickerSize = DEFAULT_STICKER_SIZE,
  stickerNoPlay,
  rarity,
  isSelected,
  className,
  clickArg,
  children,
  observeIntersection,
  onClick,
}: OwnProps<T>) => {
  const stickerRef = useRef<HTMLDivElement>();

  const customColor = useDynamicColorListener(stickerRef, undefined, !sticker?.shouldUseTextColor);

  const radialPatternBackdrop = useMemo(() => {
    if (!backdrop) return undefined;

    const backdropColors: [string, string] = [backdrop.centerColor, backdrop.edgeColor];

    return (
      <RadialPatternBackground
        className={styles.radialPattern}
        backgroundColors={backdropColors}
        patternIcon={patternSticker}
        ringsCount={1}
        ovalFactor={1}
      />
    );
  }, [backdrop, patternSticker]);

  const handleClick = useLastCallback(() => {
    onClick?.(clickArg!);
  });

  return (
    <div
      ref={ref}
      className={buildClassName(
        styles.root,
        isSelected && styles.selected,
        radialPatternBackdrop && styles.hasBackground,
        className,
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={handleClick}
    >
      {radialPatternBackdrop}

      <div
        ref={stickerRef}
        className={styles.stickerWrapper}
        style={`width: ${stickerSize}px; height: ${stickerSize}px`}
      >
        {sticker && (
          <StickerView
            containerRef={stickerRef}
            sticker={sticker}
            size={stickerSize}
            observeIntersectionForPlaying={observeIntersection}
            observeIntersectionForLoading={observeIntersection}
            shouldPreloadPreview
            noPlay={stickerNoPlay}
            customColor={customColor}
          />
        )}
      </div>
      {rarity && (
        <GiftRarityBadge
          rarity={rarity}
          className={buildClassName(styles.rarity, rarity.type === 'regular' && styles.regular)}
        />
      )}
      {children}
    </div>
  );
};

export default memo(GiftAttributeItem);
