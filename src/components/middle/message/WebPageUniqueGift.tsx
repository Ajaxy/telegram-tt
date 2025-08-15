import { memo, useRef } from '@teact';

import type { ApiStarGiftUnique } from '../../../api/types';

import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment.ts';
import { getGiftAttributes } from '../../common/helpers/gifts';

import useFlag from '../../../hooks/useFlag.ts';
import { type ObserveFn } from '../../../hooks/useIntersectionObserver';

import RadialPatternBackground from '../../common/profile/RadialPatternBackground';
import StickerView from '../../common/StickerView';

import styles from './WebPageUniqueGift.module.scss';

type OwnProps = {
  gift: ApiStarGiftUnique;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onClick?: NoneToVoidFunction;
};

const STAR_GIFT_STICKER_SIZE = 120;

const WebPageUniqueGift = ({
  gift,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  onClick,
}: OwnProps) => {
  const stickerRef = useRef<HTMLDivElement>();
  const {
    backdrop, model, pattern,
  } = getGiftAttributes(gift)!;

  const [isHover, markHover, unmarkHover] = useFlag();

  const backgroundColors = [backdrop!.centerColor, backdrop!.edgeColor];

  return (
    <div
      className={styles.root}
      onClick={onClick}
      onMouseEnter={!IS_TOUCH_ENV ? markHover : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? unmarkHover : undefined}
    >
      <div className={styles.backgroundWrapper}>
        <RadialPatternBackground
          className={styles.background}
          backgroundColors={backgroundColors}
          patternColor={backdrop!.patternColor}
          patternIcon={pattern!.sticker}
        />
      </div>
      <div ref={stickerRef} className={styles.stickerWrapper}>
        <StickerView
          containerRef={stickerRef}
          sticker={model!.sticker}
          size={STAR_GIFT_STICKER_SIZE}
          shouldLoop={isHover}
          observeIntersectionForPlaying={observeIntersectionForPlaying}
          observeIntersectionForLoading={observeIntersectionForLoading}
        />
      </div>
    </div>
  );
};

export default memo(WebPageUniqueGift);
