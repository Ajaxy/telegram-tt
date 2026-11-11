import { memo, useRef, useState } from '../../../lib/teact/teact';

import type { ApiMediaAreaCoordinates, ApiStarGiftUnique, ApiWalletCardSticker } from '../../../api/types';

import { getStickerFromGift } from '../../common/helpers/gifts';

import useResizeObserver from '../../../hooks/useResizeObserver';
import useUniqueId from '../../../hooks/useUniqueId';

import StickerView from '../../common/StickerView';

import styles from './WalletCardStickers.module.scss';

type OwnProps = {
  stickers: ApiWalletCardSticker[];
};

type Size = {
  width: number;
  height: number;
};

// The die-cut of the iOS card: the solid part of the sticker is blurred by 1.5% of its side, and the alpha ramp
// `alpha * 10 - 150 / 255` turns the blur into a white edge with round corners
const CUTOUT_BLUR = 0.015;
const CUTOUT_RAMP = '0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 10 -0.588';
const SOLID_ALPHA = '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 255 -127';

const WalletCardStickers = ({ stickers }: OwnProps) => {
  const ref = useRef<HTMLDivElement>();
  const [cardSize, setCardSize] = useState<Size>();
  const cutoutId = useUniqueId();

  useResizeObserver(ref, ({ contentRect: { width, height } }) => {
    setCardSize({ width, height });
  });

  return (
    <div
      ref={ref}
      className={styles.root}
      style={`--sticker-cutout: url(#${cutoutId})`}
      aria-hidden
    >
      <svg className={styles.filters}>
        <filter id={cutoutId} primitiveUnits="objectBoundingBox" color-interpolation-filters="sRGB">
          <feColorMatrix in="SourceAlpha" values={SOLID_ALPHA} />
          <feGaussianBlur stdDeviation={CUTOUT_BLUR} />
          <feColorMatrix values={CUTOUT_RAMP} />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </svg>
      {cardSize && stickers.map(({ coordinates, gift }) => (
        <WalletCardSticker key={gift.id} coordinates={coordinates} gift={gift} cardSize={cardSize} />
      ))}
    </div>
  );
};

const WalletCardSticker = ({ coordinates, gift, cardSize }: {
  coordinates: ApiMediaAreaCoordinates;
  gift: ApiStarGiftUnique;
  cardSize: Size;
}) => {
  const ref = useRef<HTMLDivElement>();

  const sticker = getStickerFromGift(gift);
  if (!sticker) return undefined;

  const {
    x, y, width, height, rotation,
  } = coordinates;
  // The sticker is a square that fits its area, as on the native clients; `x` and `y` are its center
  const size = Math.round(Math.min(width * cardSize.width, height * cardSize.height) / 100);

  return (
    <div
      ref={ref}
      className={styles.sticker}
      style={`left: ${x}%; top: ${y}%; width: ${size}px; height: ${size}px; rotate: ${rotation}deg`}
    >
      <StickerView containerRef={ref} sticker={sticker} size={size} noPlay />
    </div>
  );
};

export default memo(WalletCardStickers);
