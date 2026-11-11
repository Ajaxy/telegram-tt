import type {
  ApiStarGiftAttributeBackdrop, ApiStarGiftAttributePattern, ApiWalletCardSticker,
} from '../../../../api/types';
import type { Point, Size } from './cardStickers';
import type { WalletCardTint } from './cardTint';

import { clamp, getSmoothStep } from '../../../../util/math';
import { getGiftAttributes } from '../../../common/helpers/gifts';
import {
  CARD_FACE_VARIABLES, formatWalletCardTint, getWalletCardTint, mixWalletCardTints,
} from './cardTint';

// The wave of a card color change, ported from the iOS app (`WalletCardStyleTransition`). A new color spreads in a
// circle from its sticker; a removed one shrinks back into it.

export type CardStyle = {
  address: string;
  backdrop: ApiStarGiftAttributeBackdrop;
  pattern?: ApiStarGiftAttributePattern;
};

export type StyleWave = {
  from?: CardStyle;
  to?: CardStyle;
  // Fractions of the face
  origin: Point;
  // Seconds; unset while the sticker of the new color flies to the card
  start?: number;
  isRemoving: boolean;
  // The area the circle grows to cover: the face and the buttons under it, measured from the top left corner of the
  // face
  coverSize?: Size;
  // The share of the wave gone by at this frame
  fraction: number;
};

type StyleWaveFrame = {
  // How far the new color has spread
  progress: number;
  // How far the labels have taken the new color
  textMix: number;
  // The time of the pattern flight, which runs faster than the wave
  patternTime: number;
  // The share of the full circle a removed color keeps
  contraction: number;
  isRemoving: boolean;
};

export const STYLE_APPLY_DURATION = 1.05;
export const STYLE_REMOVE_DURATION = 0.6;
export const STYLE_WAVE_EDGE = 18;

const RADIUS_REACH = 1.05;
const TEXT_START = 0.25;
const TEXT_SPAN = 0.45;
const PATTERN_SPEED = 1.05 / 0.45;
const PATTERN_FAR = 0.8;
const PATTERN_OVERSHOOT_CUBIC = 2.2;
const PATTERN_OVERSHOOT_QUADRATIC = 1.2;
const PATTERN_MIN_SCALE = 0.35;
// A removed color holds the whole card for a while and then shrinks fast: x²(2.25x − 1.25)
const PULL_SLOPE = 2.25;
const PULL_OFFSET = 1.25;
const APPLY_EASE_POWER = 4;
const CARD_CENTER: Point = { x: 0.5, y: 0.5 };

const MIXED_VARIABLES_EXCLUDED = new Set(CARD_FACE_VARIABLES);
const tintsByStyle = new WeakMap<CardStyle, WalletCardTint>();

// The background of the card is the backdrop of the gift whose sticker `backgroundAddress` names
export function getWalletCardStyle(stickers?: ApiWalletCardSticker[], backgroundAddress?: string) {
  const gift = backgroundAddress ? stickers?.find(({ address }) => address === backgroundAddress)?.gift : undefined;
  const { backdrop, pattern } = (gift && getGiftAttributes(gift)) || {};

  return backgroundAddress && backdrop ? { address: backgroundAddress, backdrop, pattern } : undefined;
}

export function createStyleWave(
  from: CardStyle | undefined, to: CardStyle | undefined, origins: Record<string, Point>,
): StyleWave {
  const originAddress = (to ?? from)?.address;

  return {
    from,
    to,
    origin: (originAddress && origins[originAddress]) || CARD_CENTER,
    isRemoving: !to,
    fraction: 0,
  };
}

// A new color waits until its sticker touches the card
export function getIsStyleWaveHeld(wave: StyleWave, heldAddresses?: string[]) {
  return wave.start === undefined && Boolean(wave.to && heldAddresses?.includes(wave.to.address));
}

export function getStyleWaveFrame(fraction: number, isRemoving: boolean): StyleWaveFrame {
  const time = clamp(fraction, 0, 1);
  const pull = time * time * (PULL_SLOPE * time - PULL_OFFSET);
  const progress = isRemoving ? Math.max(0, pull) : 1 - (1 - time) ** APPLY_EASE_POWER;

  return {
    progress,
    textMix: getSmoothStep((progress - TEXT_START) / TEXT_SPAN),
    patternTime: isRemoving ? 1 : Math.min(1, time * PATTERN_SPEED),
    contraction: isRemoving ? 1 - pull : 1,
    isRemoving,
  };
}

export function getStyleWaveRadius(frame: StyleWaveFrame, origin: Point, size: Size) {
  const full = Math.hypot(Math.max(origin.x, size.width - origin.x), Math.max(origin.y, size.height - origin.y))
    * RADIUS_REACH;

  return full * (frame.isRemoving ? clamp(frame.contraction, 0, 1) : frame.progress);
}

// The circle of a wave in pixels of a face of the given size
export function getStyleWaveCircle(wave: StyleWave, width: number, height: number) {
  const frame = getStyleWaveFrame(wave.fraction, wave.isRemoving);
  const origin = { x: wave.origin.x * width, y: wave.origin.y * height };

  return { frame, origin, radius: getStyleWaveRadius(frame, origin, wave.coverSize ?? { width, height }) };
}

// How far the pattern symbols stand from the origin, against their places: new ones fly out with a little overshoot,
// removed ones close in
export function getStylePatternApproach(frame: StyleWaveFrame) {
  if (frame.isRemoving) return PATTERN_FAR + (1 - PATTERN_FAR) * clamp(frame.contraction, 0, 1);

  const time = frame.patternTime;
  const fly = 1 + PATTERN_OVERSHOOT_CUBIC * (time - 1) ** 3 + PATTERN_OVERSHOOT_QUADRATIC * (time - 1) ** 2;

  return PATTERN_FAR + (1 - PATTERN_FAR) * fly;
}

export function getStylePatternScale(frame: StyleWaveFrame, approach: number) {
  return frame.isRemoving ? PATTERN_MIN_SCALE + (1 - PATTERN_MIN_SCALE) * approach : 1;
}

// The card face keeps the old color under the wave, or the new one under a receding color, and the labels and edges
// take the colors between the two
export function buildStyleWaveStyles(wave: StyleWave, width: number, height: number) {
  const { frame, origin, radius } = getStyleWaveCircle(wave, width, height);
  const from = getStyleTint(wave.from);
  const to = getStyleTint(wave.to);
  const mixed = mixWalletCardTints(from, to, frame.textMix);
  const mixedNames = Object.keys(mixed).filter((name) => !MIXED_VARIABLES_EXCLUDED.has(name));
  const base = wave.isRemoving ? to : from;
  const waveTint = wave.isRemoving ? from : to;

  return {
    origin,
    radius,
    fold: `${formatWalletCardTint(base, CARD_FACE_VARIABLES)} ${formatWalletCardTint(mixed, mixedNames)}`,
    face: `${formatWalletCardTint(waveTint, CARD_FACE_VARIABLES)} --wave-x: ${origin.x}px; --wave-y: ${origin.y}px; `
      + `--wave-radius: ${radius}px; --wave-inner: ${Math.max(0, radius - STYLE_WAVE_EDGE)}px;`,
  };
}

// The colors of a style stay the same through a wave, so each style is tinted once
function getStyleTint(style?: CardStyle) {
  if (!style) return getWalletCardTint();

  let tint = tintsByStyle.get(style);
  if (!tint) {
    tint = getWalletCardTint(style.backdrop.centerColor, style.backdrop.edgeColor);
    tintsByStyle.set(style, tint);
  }

  return tint;
}
