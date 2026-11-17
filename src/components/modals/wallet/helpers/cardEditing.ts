import { getActions } from '../../../../global';

import type { ApiStarGiftUnique, ApiWalletCardSticker } from '../../../../api/types';
import type { WalletCardLayout } from '../../../../global/helpers/wallet';
import type { Rect } from './cardStickerPlacement';
import type { Size } from './cardStickers';

import { WALLET_STICKER_LIMIT_MESSAGE } from '../../../../global/helpers/wallet';
import { WALLET_CARD_STICKERS_LIMIT } from '../../../../limits';
import { findStickerSpot, FIRST_SPOT } from './cardStickerPlacement';
import { buildStickerCoordinates, getCollectionSlug, getStickerPose } from './cardStickers';

import cardStyles from '../WalletCard.module.scss';

export type CardMetrics = {
  card: Size;
  contentRects: Rect[];
};

export type CardStickerRequest = {
  address: string;
  gift: ApiStarGiftUnique;
  isColor?: boolean;
  // The gift model a new sticker flies from
  source?: HTMLElement;
};

// Lets a gift screen ask the wallet screen editor to add, remove or color a sticker with its animation
export type CardEditorRef = { current: { requestSticker: (request: CardStickerRequest) => void } | undefined };

// As in the iOS app, stickers keep this distance from the card labels
const CONTENT_MARGIN_PX = 3;
const CONTENT_SELECTOR = [
  cardStyles.amountContent, cardStyles.fiat, cardStyles.ownerName, cardStyles.address, cardStyles.qrButton,
].map((name) => `.${name}`).join(',');
// As in the iOS app, the QR button and the diamond take their own presses, even under a sticker
const CARD_CONTROL_SELECTOR = `.${cardStyles.qrButton}, .${cardStyles.diamond}`;
// Where a sticker goes without a measured card
const FALLBACK_POSE = { ...FIRST_SPOT, scale: 1, rotation: 0 };

export function measureCardMetrics(face: HTMLElement) {
  const contentRects = Array.from(face.querySelectorAll<HTMLElement>(CONTENT_SELECTOR), (element) => {
    const box = getFaceRect(element, face);
    const { left, top, right, bottom } = element.classList.contains(cardStyles.amountContent)
      ? scaleAmountRect(box, element, face)
      : box;

    return {
      left: left - CONTENT_MARGIN_PX,
      top: top - CONTENT_MARGIN_PX,
      right: right + CONTENT_MARGIN_PX,
      bottom: bottom + CONTENT_MARGIN_PX,
    };
  });

  return { card: { width: face.offsetWidth, height: face.offsetHeight }, contentRects };
}

// The box of an element in layout pixels of the face, which the turn of the card does not change
export function getFaceRect(element: HTMLElement, face: HTMLElement): Rect {
  let left = 0;
  let top = 0;
  let current: HTMLElement | null = element;
  while (current && current !== face) {
    left += current.offsetLeft;
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }

  return {
    left, top, right: left + element.offsetWidth, bottom: top + element.offsetHeight,
  };
}

// `useShrinkToFit` scales the amount from the middle of its left edge. Its scale is taken from the layout, as the
// style it writes may come later.
export function scaleAmountRect(rect: Rect, content: HTMLElement, face: HTMLElement): Rect {
  const available = content.parentElement!.clientWidth;
  const scale = content.offsetWidth > available ? available / content.offsetWidth : 1;
  const box = getFaceRect(content, face);
  const originY = (box.top + box.bottom) / 2;

  return {
    left: box.left + (rect.left - box.left) * scale,
    right: box.left + (rect.right - box.left) * scale,
    top: originY + (rect.top - originY) * scale,
    bottom: originY + (rect.bottom - originY) * scale,
  };
}

export function getIsCardControl(target: EventTarget | null) {
  // Without `instanceof`, which fails for an element of another window
  return Boolean((target as Element | null)?.closest?.(CARD_CONTROL_SELECTOR));
}

export function getIsStickerOnCard(decoration: WalletCardLayout | undefined, address: string) {
  return Boolean(decoration?.stickers?.some((sticker) => sticker.address === address));
}

export function getCanColorCard(gift: ApiStarGiftUnique, collections?: string[]) {
  return Boolean(collections?.includes(getCollectionSlug(gift.slug)));
}

// Over the limit nothing is placed: the caller shakes the card. Without a measured card, as on a gift screen opened
// alone, the sticker takes a set place.
export function placeStickerOnCard(
  decoration: WalletCardLayout | undefined, address: string, gift: ApiStarGiftUnique, isBackground?: boolean,
  metrics?: CardMetrics,
): WalletCardLayout | undefined {
  const stickers = decoration?.stickers || [];
  if (stickers.length >= WALLET_CARD_STICKERS_LIMIT) return undefined;

  const spot = metrics && findStickerSpot({
    card: metrics.card,
    contentRects: metrics.contentRects,
    occupants: stickers.map(({ coordinates }) => {
      const { x, y, scale } = getStickerPose(coordinates);

      return { center: { x: x * metrics.card.width, y: y * metrics.card.height }, scale };
    }),
    scale: 1,
  });
  const pose = spot ? {
    x: spot.center.x / metrics.card.width,
    y: spot.center.y / metrics.card.height,
    scale: spot.scale,
    rotation: 0,
  } : FALLBACK_POSE;

  return {
    stickers: [...stickers, { address, gift, coordinates: buildStickerCoordinates(pose) }],
    backgroundAddress: isBackground ? address : decoration?.backgroundAddress,
  };
}

// The moved sticker goes on top, as in the iOS app
export function moveStickerOnCard(
  decoration: WalletCardLayout | undefined, sticker: ApiWalletCardSticker,
): WalletCardLayout {
  const others = decoration?.stickers?.filter(({ address }) => address !== sticker.address) || [];

  return {
    stickers: [...others, sticker],
    backgroundAddress: decoration?.backgroundAddress,
  };
}

// The background goes with its sticker
export function removeStickerFromCard(decoration: WalletCardLayout | undefined, address: string): WalletCardLayout {
  return {
    stickers: decoration?.stickers?.filter((sticker) => sticker.address !== address),
    backgroundAddress: decoration?.backgroundAddress === address ? undefined : decoration?.backgroundAddress,
  };
}

export function setCardBackground(decoration: WalletCardLayout | undefined, address?: string): WalletCardLayout {
  return {
    stickers: decoration?.stickers,
    backgroundAddress: address,
  };
}

export function saveCardDecoration({ stickers, backgroundAddress }: WalletCardLayout) {
  getActions().updateWalletCardDraft({ stickers: stickers || [], backgroundAddress });
}

export function showStickerLimitError() {
  getActions().showNotification({ message: WALLET_STICKER_LIMIT_MESSAGE });
}
