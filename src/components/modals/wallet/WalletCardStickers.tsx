import { memo, useRef, useState } from '../../../lib/teact/teact';

import type { ApiMediaAreaCoordinates, ApiStarGiftUnique, ApiWalletCardSticker } from '../../../api/types';

import { getStickerFromGift } from '../../common/helpers/gifts';

import useResizeObserver from '../../../hooks/useResizeObserver';

import StickerView from '../../common/StickerView';

import styles from './WalletCardStickers.module.scss';

type OwnProps = {
  stickers: ApiWalletCardSticker[];
};

type Size = {
  width: number;
  height: number;
};

const WalletCardStickers = ({ stickers }: OwnProps) => {
  const ref = useRef<HTMLDivElement>();
  const [cardSize, setCardSize] = useState<Size>();

  useResizeObserver(ref, ({ contentRect: { width, height } }) => {
    setCardSize({ width, height });
  });

  return (
    <div ref={ref} className={styles.root} aria-hidden>
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
