import type { Point, Size } from './cardStickers';

import { clamp } from '../../../../util/math';
import { clampStickerScale, STICKER_MIN_SCALE, STICKER_WIDTH_FRACTION } from './cardStickers';

export type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type Spot = {
  center: Point;
  scale: number;
};

type Scene = {
  side: number;
  occupants: Spot[];
  compositionCenter: Point;
  balance: Point;
};

// The grid step is in points of the 361-point card of the iOS app
const GRID_STEP = 5;
const IOS_CARD_WIDTH = 361;

// The following lengths are in sides of a new sticker
const EDGE_RADIUS = 0.5;
const CONTENT_RADIUS = 0.44;
const OCCUPANT_RADIUS = 0.29;
const GAP_RADIUS = 0.4;
const MAX_GAP_REWARD = 0.3;
const ALIGNMENT_REACH = 0.12;

// Each sticker on the card shrinks the next one by a random step
const SHRINK_STEP = 0.05;
const SHRINK_STEP_SPREAD = 0.04;
const MIN_CROWDED_SCALE = 0.74;

// A sticker closer than `EDGE_FADE` card pixels to the edge shrinks by up to `EDGE_SHRINK`
const EDGE_FADE = 14;
const EDGE_SHRINK = 0.1;

// Card fractions
export const FIRST_SPOT: Point = { x: 0.6, y: 0.68 };
const COMPOSITION_CENTER: Point = { x: 0.5, y: 0.55 };
const BALANCE_SPREAD = 0.08;

// The score is in card pixels
const JITTER = 10;
const FIRST_JITTER_SHARE = 0.5;
const FIRST_DISTANCE_WEIGHT = 0.45;
const FIRST_SIZE_WEIGHT = 1.1;
const GAP_WEIGHT = 1.2;
const OVERLAP_WEIGHT = 2.5;
const SIZE_WEIGHT = 0.9;
const ROOM_WEIGHT = 0.2;
const IMBALANCE_WEIGHT = 0.35;
const ALIGNMENT_WEIGHT = 0.08;
const CENTER_WEIGHT = 0.04;

// The iOS app's `WalletStickerPlacement.spread`: each point of a grid gets the largest scale that keeps the sticker
// clear of the edges, the card content and the other stickers, and the best scored point wins. The first sticker leans to
// the lower right; the next ones keep a gap, balance the composition and avoid lining up with the others.
export function findStickerSpot({
  card, contentRects, occupants, scale, random = Math.random,
}: {
  card: Size;
  contentRects: Rect[];
  occupants: Spot[];
  scale: number;
  random?: () => number;
}): Spot | undefined {
  const { width, height } = card;
  if (width <= 0 || height <= 0) return undefined;

  const side = width * STICKER_WIDTH_FRACTION;
  const step = (GRID_STEP * width) / IOS_CARD_WIDTH;
  const margin = STICKER_MIN_SCALE * side * EDGE_RADIUS;
  const shrinkStep = SHRINK_STEP + SHRINK_STEP_SPREAD * random();
  const crowdedScale = clampStickerScale(scale) * Math.max(MIN_CROWDED_SCALE, 1 - shrinkStep * occupants.length);
  const scene: Scene = {
    side,
    occupants,
    compositionCenter: { x: width * COMPOSITION_CENTER.x, y: height * COMPOSITION_CENTER.y },
    balance: {
      x: width * (COMPOSITION_CENTER.x + BALANCE_SPREAD * (random() - 0.5)),
      y: height * (COMPOSITION_CENTER.y + BALANCE_SPREAD * (random() - 0.5)),
    },
  };
  const home = { x: width * FIRST_SPOT.x, y: height * FIRST_SPOT.y };

  let best: Spot | undefined;
  let bestScore = -Infinity;

  for (let y = margin; y <= height - margin; y += step) {
    for (let x = margin; x <= width - margin; x += step) {
      const point = { x, y };
      const edgeRoom = Math.min(x, width - x, y, height - y);
      const contentRoom = contentRects.reduce((room, rect) => Math.min(room, getRectDistance(point, rect)), Infinity);

      let spotScale = Math.min(crowdedScale, edgeRoom / (side * EDGE_RADIUS), contentRoom / (side * CONTENT_RADIUS));
      for (const occupant of occupants) {
        const occupantRoom = getDistance(occupant.center, point) / (side * OCCUPANT_RADIUS);
        spotScale = Math.min(spotScale, occupantRoom - occupant.scale);
      }

      const edgeGap = edgeRoom - side * EDGE_RADIUS * spotScale;
      spotScale *= 1 - EDGE_SHRINK + EDGE_SHRINK * clamp(edgeGap / EDGE_FADE, 0, 1);
      if (spotScale < STICKER_MIN_SCALE) continue;

      const spot = { center: point, scale: spotScale };
      const score = occupants.length
        ? scoreCrowdedSpot(spot, Math.min(edgeRoom, contentRoom), scene) + random() * JITTER
        : -FIRST_DISTANCE_WEIGHT * getDistance(point, home) + FIRST_SIZE_WEIGHT * spotScale * side
          + random() * JITTER * FIRST_JITTER_SHARE;
      if (score > bestScore) {
        bestScore = score;
        best = spot;
      }
    }
  }

  return best;
}

function scoreCrowdedSpot({ center: point, scale }: Spot, room: number, {
  side, occupants, compositionCenter, balance,
}: Scene) {
  const reach = side * ALIGNMENT_REACH;
  let gap = Infinity;
  let massX = point.x * scale * scale;
  let massY = point.y * scale * scale;
  let mass = scale * scale;
  let alignment = 0;

  for (const occupant of occupants) {
    const weight = occupant.scale * occupant.scale;
    gap = Math.min(gap, getDistance(occupant.center, point) - side * GAP_RADIUS * (occupant.scale + scale));
    massX += occupant.center.x * weight;
    massY += occupant.center.y * weight;
    mass += weight;
    alignment += Math.max(0, 1 - Math.abs(occupant.center.y - point.y) / reach);
    alignment += Math.max(0, 1 - Math.abs(occupant.center.x - point.x) / reach);
  }

  const gapScore = gap < 0 ? gap * OVERLAP_WEIGHT : Math.min(gap, side * MAX_GAP_REWARD);
  const imbalance = Math.hypot(massX / mass - balance.x, massY / mass - balance.y);
  return GAP_WEIGHT * gapScore + SIZE_WEIGHT * scale * side + ROOM_WEIGHT * Math.min(room, side)
    - IMBALANCE_WEIGHT * imbalance - alignment * side * ALIGNMENT_WEIGHT
    - CENTER_WEIGHT * getDistance(point, compositionCenter);
}

function getRectDistance(point: Point, { left, top, right, bottom }: Rect) {
  return Math.hypot(clamp(point.x, left, right) - point.x, clamp(point.y, top, bottom) - point.y);
}

function getDistance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
