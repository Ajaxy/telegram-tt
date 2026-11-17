import type { ApiMediaAreaCoordinates, ApiWalletCardSticker } from '../../../../api/types';
import type { Rect } from './cardStickerPlacement';

import { clamp } from '../../../../util/math';

export type Point = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

// `x` and `y` are the center in fractions of the card; `scale` is relative to the side of a new sticker
export type StickerPose = {
  x: number;
  y: number;
  scale: number;
  // Degrees
  rotation: number;
};

// The iOS app's measures: a new sticker is 83.4 points wide on a 361-point card
export const STICKER_WIDTH_FRACTION = 83.4 / 361;
export const STICKER_MIN_SCALE = 32 / 83.4;
export const STICKER_MAX_SCALE = 1.1;

// The iOS app writes the height for its 370 × 220 card, whatever the shape of the card on screen
const PERCENT = 100;
const IOS_CARD_ASPECT_RATIO = 370 / 220;
const HIT_RADIUS = 0.42;
// A sticker released this far past the edge, in its sides, still lands on the card
const DROP_REACH = 0.3;
const SNAP_ANGLE = 45;

export function getStickerPose({
  x, y, width, rotation,
}: ApiMediaAreaCoordinates): StickerPose {
  return {
    x: x / PERCENT,
    y: y / PERCENT,
    scale: width / PERCENT / STICKER_WIDTH_FRACTION,
    rotation,
  };
}

// `radius` comes from another client and is kept as is
export function buildStickerCoordinates(
  {
    x, y, scale, rotation,
  }: StickerPose,
  radius?: number,
): ApiMediaAreaCoordinates {
  const width = STICKER_WIDTH_FRACTION * scale * PERCENT;

  return {
    x: x * PERCENT,
    y: y * PERCENT,
    width,
    height: width * IOS_CARD_ASPECT_RATIO,
    rotation: normalizeRotation(rotation),
    radius,
  };
}

// The sticker is a square that fits its area, as on the native clients
export function getStickerSide({ width, height }: ApiMediaAreaCoordinates, card: Size) {
  return Math.min(width * card.width, height * card.height) / PERCENT;
}

export function clampStickerScale(scale: number) {
  return clamp(scale, STICKER_MIN_SCALE, STICKER_MAX_SCALE);
}

function normalizeRotation(rotation: number) {
  const turn = rotation % 360;

  return turn < 0 ? turn + 360 : turn;
}

// The last sticker is drawn on top, so the search goes from the end
export function findStickerAt(stickers: ApiWalletCardSticker[], point: Point, card: Size) {
  for (let i = stickers.length - 1; i >= 0; i--) {
    const { coordinates } = stickers[i];
    const centerX = (coordinates.x / PERCENT) * card.width;
    const centerY = (coordinates.y / PERCENT) * card.height;

    if (Math.hypot(point.x - centerX, point.y - centerY) < getStickerSide(coordinates, card) * HIT_RADIUS) {
      return stickers[i];
    }
  }

  return undefined;
}

// As in the iOS app, a sticker covers a label its circle of the hit radius reaches
export function getIsRectCovered(rect: Rect, stickers: ApiWalletCardSticker[], card: Size) {
  return stickers.some(({ coordinates }) => {
    const x = (coordinates.x / PERCENT) * card.width;
    const y = (coordinates.y / PERCENT) * card.height;
    const dx = Math.max(rect.left - x, 0, x - rect.right);
    const dy = Math.max(rect.top - y, 0, y - rect.bottom);

    return Math.hypot(dx, dy) < getStickerSide(coordinates, card) * HIT_RADIUS;
  });
}

// The card pixels of the center a released sticker lands on; `undefined` takes it off the card
export function getDropCenter(center: Point, side: number, card: Size): Point | undefined {
  const reach = side * DROP_REACH;
  if (center.x < -reach || center.x > card.width + reach || center.y < -reach || center.y > card.height + reach) {
    return undefined;
  }

  return {
    x: clamp(center.x, 0, card.width),
    y: clamp(center.y, 0, card.height),
  };
}

// The handles of the desktop app: the turn from the pressed point to the cursor around the center rotates the
// sticker, and the ratio of their distances scales it. A snapped turn goes in 45° steps and keeps the size.
export function getHandlePose(
  from: StickerPose, center: Point, pressed: Point, cursor: Point, isSnapped?: boolean,
): StickerPose | undefined {
  const wasX = pressed.x - center.x;
  const wasY = pressed.y - center.y;
  const nowX = cursor.x - center.x;
  const nowY = cursor.y - center.y;
  const distance = Math.hypot(wasX, wasY);
  const reached = Math.hypot(nowX, nowY);
  if (!distance) return undefined;

  const turn = reached ? ((Math.atan2(nowY, nowX) - Math.atan2(wasY, wasX)) * 180) / Math.PI : 0;
  const rotation = from.rotation + turn - 360 * Math.round(turn / 360);

  if (isSnapped) {
    return { ...from, rotation: Math.round(rotation / SNAP_ANGLE) * SNAP_ANGLE };
  }

  return { ...from, rotation, scale: clampStickerScale((from.scale * reached) / distance) };
}

export function getCollectionSlug(slug: string) {
  return slug.replace(/-\d+$/, '');
}
