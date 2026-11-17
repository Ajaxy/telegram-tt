import type { ApiMediaAreaCoordinates, ApiStarGiftUnique, ApiWalletCardSticker } from '../../../../api/types';
import type { WalletCardLayout } from '../../../../global/helpers/wallet';
import type { CardMetrics } from './cardEditing';
import type { Point, Size } from './cardStickers';

import { WALLET_CARD_STICKERS_LIMIT } from '../../../../limits';
import {
  getCanColorCard, getIsStickerOnCard, moveStickerOnCard, placeStickerOnCard, removeStickerFromCard, setCardBackground,
} from './cardEditing';
import { buildStickerCoordinates, getDropCenter, STICKER_WIDTH_FRACTION } from './cardStickers';

// What a menu or a gift screen does to the card. A new sticker comes with the place it is thrown to.
type StickerChange =
  | { type: 'background'; decoration: WalletCardLayout }
  | { type: 'remove'; sticker: ApiWalletCardSticker }
  | { type: 'place'; decoration: WalletCardLayout; coordinates: ApiMediaAreaCoordinates }
  | { type: 'restricted' }
  | { type: 'limit' };

// What a released sticker does: it sticks where it is, sticks a moment over the limit, or flies home
type StickerDrop =
  | { type: 'stick'; coordinates: ApiMediaAreaCoordinates; decoration?: WalletCardLayout }
  | { type: 'home'; decoration?: WalletCardLayout };

type StickerCommand = {
  address: string;
  gift: ApiStarGiftUnique;
  isColor?: boolean;
};

type StickerRelease = {
  address: string;
  gift: ApiStarGiftUnique;
  // Set when the sticker was taken from the card
  sticker?: ApiWalletCardSticker;
  // Card pixels of the released center
  center: Point;
  scale: number;
  // Radians
  angle: number;
};

export function planStickerChange(
  decoration: WalletCardLayout | undefined, { address, gift, isColor }: StickerCommand, collections?: string[],
  metrics?: CardMetrics,
): StickerChange {
  const isOnCard = getIsStickerOnCard(decoration, address);

  if (isColor) {
    if (decoration?.backgroundAddress === address) {
      return { type: 'background', decoration: setCardBackground(decoration, undefined) };
    }

    if (!getCanColorCard(gift, collections)) return { type: 'restricted' };
    if (isOnCard) return { type: 'background', decoration: setCardBackground(decoration, address) };
  } else if (isOnCard) {
    return { type: 'remove', sticker: decoration!.stickers!.find((sticker) => sticker.address === address)! };
  }

  const next = placeStickerOnCard(decoration, address, gift, isColor, metrics);
  if (!next) return { type: 'limit' };

  return { type: 'place', decoration: next, coordinates: next.stickers!.at(-1)!.coordinates };
}

// Released over the card or a little past it, the sticker sticks there; farther away it flies home and leaves the card
export function planStickerDrop(
  decoration: WalletCardLayout | undefined, {
    address, gift, sticker, center, scale, angle,
  }: StickerRelease, card: Size,
): StickerDrop {
  const dropCenter = getDropCenter(center, STICKER_WIDTH_FRACTION * scale * card.width, card);
  if (!dropCenter) {
    return { type: 'home', decoration: sticker && removeStickerFromCard(decoration, address) };
  }

  const coordinates = buildStickerCoordinates({
    x: dropCenter.x / card.width,
    y: dropCenter.y / card.height,
    scale,
    rotation: (angle * 180) / Math.PI,
  }, sticker?.coordinates.radius);

  // Over the limit nothing is saved: the sticker sticks a moment and goes home
  if (!sticker && (decoration?.stickers?.length || 0) >= WALLET_CARD_STICKERS_LIMIT) {
    return { type: 'stick', coordinates };
  }

  return { type: 'stick', coordinates, decoration: moveStickerOnCard(decoration, { address, gift, coordinates }) };
}
