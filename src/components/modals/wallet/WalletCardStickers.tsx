import { memo, useRef, useState } from '../../../lib/teact/teact';

import type { ApiMediaAreaCoordinates, ApiStarGiftUnique, ApiWalletCardSticker } from '../../../api/types';
import type { Size } from './helpers/cardStickers';

import buildClassName from '../../../util/buildClassName';
import { getStickerFromGift } from '../../common/helpers/gifts';
import { getStickerSide } from './helpers/cardStickers';
import {
  CUTOUT_BLUR, CUTOUT_GAIN, CUTOUT_OFFSET, MAX_ALPHA, SOLID_ALPHA_FROM,
} from './helpers/stickerTexture';
import { CARD_STICKER_ATTRIBUTE, CARD_STICKER_LIFT_ATTRIBUTE } from './useStickerMotion';

import useResizeObserver from '../../../hooks/useResizeObserver';
import useUniqueId from '../../../hooks/useUniqueId';

import StickerView from '../../common/StickerView';

import styles from './WalletCardStickers.module.scss';

type OwnProps = {
  stickers: ApiWalletCardSticker[];
  // The stickers in motion are drawn above the screen instead
  hiddenAddresses?: string[];
  playingAddress?: string;
  onPlayEnd?: NoneToVoidFunction;
};

const SOLID_ALPHA = `0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${MAX_ALPHA} ${-SOLID_ALPHA_FROM}`;
const CUTOUT_RAMP = `0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 ${CUTOUT_GAIN} ${-CUTOUT_OFFSET / MAX_ALPHA}`;

const WalletCardStickers = ({
  stickers, hiddenAddresses, playingAddress, onPlayEnd,
}: OwnProps) => {
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
      {cardSize && stickers.map(({ address, coordinates, gift }) => (
        <WalletCardSticker
          key={address}
          address={address}
          coordinates={coordinates}
          gift={gift}
          cardSize={cardSize}
          isHidden={hiddenAddresses?.includes(address)}
          isPlaying={address === playingAddress}
          onPlayEnd={onPlayEnd}
        />
      ))}
    </div>
  );
};

const WalletCardSticker = ({
  address, coordinates, gift, cardSize, isHidden, isPlaying, onPlayEnd,
}: {
  address: string;
  coordinates: ApiMediaAreaCoordinates;
  gift: ApiStarGiftUnique;
  cardSize: Size;
  isHidden?: boolean;
  isPlaying?: boolean;
  onPlayEnd?: NoneToVoidFunction;
}) => {
  const ref = useRef<HTMLDivElement>();

  const sticker = getStickerFromGift(gift);
  if (!sticker) return undefined;

  const { x, y, rotation } = coordinates;
  const size = Math.round(getStickerSide(coordinates, cardSize));

  return (
    <div
      ref={ref}
      className={buildClassName(styles.sticker, isHidden && styles.hidden)}
      style={`left: ${x}%; top: ${y}%; width: ${size}px; height: ${size}px; rotate: ${rotation}deg`}
      {...{ [CARD_STICKER_ATTRIBUTE]: address }}
    >
      {/* A tapped sticker grows and casts a shadow here, outside the die-cut */}
      <div className={styles.lift} {...{ [CARD_STICKER_LIFT_ATTRIBUTE]: true }}>
        <div className={styles.cutout}>
          <StickerView
            containerRef={ref}
            sticker={sticker}
            size={size}
            noPlay={!isPlaying}
            onAnimatedStickerLoop={onPlayEnd}
            onVideoEnded={onPlayEnd}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(WalletCardStickers);
