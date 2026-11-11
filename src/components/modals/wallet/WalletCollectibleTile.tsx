import { memo, useMemo, useRef } from '../../../lib/teact/teact';

import type { ApiWalletCollectible } from '../../../api/types';

import { convertColor } from '../../../lib/color';
import { getStickerMediaHash } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { buildColorFromHex, buildHexFromColor } from '../../../util/colors';
import { clamp } from '../../../util/math';
import { getGiftAttributes, getStickerFromGift } from '../../common/helpers/gifts';

import useClickable from '../../../hooks/useClickable';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';

import GiftRibbon from '../../common/gift/GiftRibbon';
import RadialPatternBackground from '../../common/profile/RadialPatternBackground';
import StickerView from '../../common/StickerView';
import WalletCollectibleImage from './WalletCollectibleImage';

import styles from './WalletCollectibleTile.module.scss';

type OwnProps = {
  collectible: ApiWalletCollectible;
  // The model leaves a silhouette in the tile while it is on the card or carried
  isOnCard?: boolean;
  className?: string;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>, collectible: ApiWalletCollectible) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>, collectible: ApiWalletCollectible) => void;
  onClick: (collectible: ApiWalletCollectible) => void;
};

export const TILE_MODEL_ATTRIBUTE = 'data-sticker-address';
const MODEL_SIZE = 84;
// The silhouette of the iOS app: the edge color with more saturation and less brightness
const SILHOUETTE_SATURATION = 1.1;
const SILHOUETTE_BRIGHTNESS = 0.86;
// Color.js keeps HSV saturation and value in 0…100
const MAX_HSV_CHANNEL = 100;

const WalletCollectibleTile = ({
  collectible, isOnCard, className, onPointerDown, onContextMenu, onClick,
}: OwnProps) => {
  const lang = useLang();
  const modelRef = useRef<HTMLDivElement>();

  const gift = collectible.type === 'gift' ? collectible.gift : undefined;
  const sticker = gift && getStickerFromGift(gift);
  const { backdrop, pattern } = (gift && getGiftAttributes(gift)) || {};
  const backdropColors = useMemo(() => backdrop && [backdrop.centerColor, backdrop.edgeColor], [backdrop]);
  const ribbonColor = useMemo(
    () => backdrop && [backdrop.edgeColor, backdrop.centerColor] as const,
    [backdrop],
  );
  // Loaded ahead, so the silhouette shows in the same frame the model leaves
  const silhouetteUrl = useMedia(sticker && getStickerMediaHash(sticker, 'preview'));

  const handlePointerDown = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    onPointerDown?.(e, collectible);
  });

  const handleContextMenu = useLastCallback((e: React.MouseEvent<HTMLDivElement>) => {
    onContextMenu?.(e, collectible);
  });

  const handleClick = useLastCallback(() => {
    onClick(collectible);
  });
  const clickableProps = useClickable(handleClick);
  const label = collectible.name ?? lang('WalletCollectibleTitle');

  if (!gift || !sticker) {
    return (
      <div className={buildClassName(styles.root, className)} aria-label={label} {...clickableProps}>
        <WalletCollectibleImage collectible={collectible} isFull className={styles.image} />
      </div>
    );
  }

  return (
    <div
      className={buildClassName(styles.root, className)}
      onPointerDown={handlePointerDown}
      onContextMenu={handleContextMenu}
      aria-label={label}
      {...clickableProps}
    >
      {backdropColors && (
        <RadialPatternBackground
          className={styles.backdrop}
          backgroundColors={backdropColors}
          patternIcon={pattern?.sticker}
          patternSize={14}
          ringsCount={1}
          ovalFactor={1}
          withAdaptiveHeight
        />
      )}
      <div
        ref={modelRef}
        className={buildClassName(styles.model, isOnCard && styles.modelHidden)}
        style={`width: ${MODEL_SIZE}px; height: ${MODEL_SIZE}px`}
        {...{ [TILE_MODEL_ATTRIBUTE]: collectible.address }}
      >
        <StickerView containerRef={modelRef} sticker={sticker} size={MODEL_SIZE} shouldPreloadPreview />
      </div>
      {isOnCard && silhouetteUrl && backdrop && (
        <div
          className={styles.silhouette}
          style={`width: ${MODEL_SIZE}px; height: ${MODEL_SIZE}px; mask-image: url(${silhouetteUrl}); `
            + `background-color: ${getSilhouetteColor(backdrop.edgeColor)}`}
        />
      )}
      {ribbonColor && <GiftRibbon color={ribbonColor} text={`#${gift.number}`} />}
    </div>
  );
};

function getSilhouetteColor(hex: string) {
  const hsv = convertColor(buildColorFromHex(hex), 'hsv');
  const [hue, saturation, value] = hsv.coords;
  const nextSaturation = clamp((saturation ?? 0) * SILHOUETTE_SATURATION, 0, MAX_HSV_CHANNEL);

  return buildHexFromColor(convertColor({
    ...hsv,
    coords: [hue, nextSaturation, (value ?? 0) * SILHOUETTE_BRIGHTNESS],
  }, 'srgb'));
}

export default memo(WalletCollectibleTile);
