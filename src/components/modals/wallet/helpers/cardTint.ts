import { buildColor, convertColor } from '../../../../lib/color';
import { buildColorFromHex, buildHexFromColor } from '../../../../util/colors';
import { clamp, isBetween, round } from '../../../../util/math';

// The iOS app's recoloring of the stock blue card into the hue of a collectible gift's backdrop
// (`WalletCardTint` and `WalletGiftPattern` in `WalletCardGiftStyle.swift`)

type Oklch = {
  l: number;
  c: number;
  // Radians
  h: number;
};

export type WalletCardPatternItem = {
  x: number;
  y: number;
  size: number;
};

type Vector = [number, number, number];

type Tint = {
  hue: number;
  chroma: number;
  cap: number;
  darkness: number;
  edgeL: number;
  centerL: number;
  darkC: number;
  lShift: number;
};

type TintRule = (tint: Tint, stock: Oklch) => Vector;
type ColorFormat = (rgb: Vector) => string;
type TintedVariable = [name: string, stockColor: string, rule: TintRule, format: ColorFormat];

// The sRGB colors of the card variables, which a style change mixes
export type WalletCardTint = Record<string, Vector>;

const CHANNEL_MAX = 255;
const DEGREES_PER_RADIAN = 180 / Math.PI;
const GAMUT_TOLERANCE = 0.001;
const GAMUT_CHROMA_STEP = 0.95;
const GAMUT_MAX_STEPS = 40;

const STOCK_DARK = convertHexToOklch('#088fee');
const STOCK_LIGHT = convertHexToOklch('#16abf9');
const STOCK_ACCENT = convertHexToOklch('#6ddcff');
const STOCK_ADDRESS = convertHexToOklch('#2a83e2');

const FULL_TURN_DEGREES = 360;
const VIOLET_HUE = 300;
const VIOLET_HUE_SPREAD = 38;
const VIOLET_CHROMA_BOOST = 0.18;
const VIOLET_L_SHIFT = 0.025;
const CHROMA_GAIN = 1.5 / 0.155;
const MIN_CHROMA_SCALE = 0.15;
const DARKNESS_START_L = 0.6;
const DARKNESS_RANGE_L = 0.15;
const CAP_CHROMA_SCALE = 1.2;
const DARK_CHROMA_SCALE = 1.1;
const CAP_REFERENCE_CHROMA = 0.173;
const EDGE_L_OFFSET = 0.02;
const MIN_STOCK_POSITION = -2;
const MAX_STOCK_POSITION = 3;
const MIN_L = 0.05;
const MAX_L = 0.97;
const ACCENT_MIN_L = 0.8;
const ADDRESS_DARK_SURFACE_L = 0.5;
const ADDRESS_ACCENT_L_SCALE = 0.8;
const ADDRESS_L_DROP = 0.22;
const ADDRESS_CHROMA_SCALE = 1.1;
const DARK_CARD_EDGE_L = 0.2;
const GLINT_L_SCALE = 0.86;
const GLINT_CHROMA_SCALE = 1.6;
const SHADOW_ALPHA = '60%';
const ADDRESS_ALPHA = '80%';
const WHITE: Vector = [1, 1, 1];

export const IOS_CARD_WIDTH = 370;
const PATTERN_COLUMN_PITCH = 84;
const PATTERN_ROW_PITCH = 25;
const PATTERN_ITEM_SIZE = 20;
const PATTERN_SHIFT_X = 4;

export const CARD_FACE_VARIABLES = ['--card-face-start', '--card-face-middle', '--card-face-end'];
const ADDRESS_VARIABLE = '--card-address';
const GLINT_VARIABLE = '--card-glint';

const TINTED_VARIABLES: TintedVariable[] = [
  ['--card-face-start', '#5cc8ff', getTintedRgb, formatHex],
  ['--card-face-middle', '#0088ff', getTintedRgb, formatHex],
  ['--card-face-end', '#0057c2', getTintedRgb, formatHex],
  ['--card-edge-start', '#2a64c4', getTintedRgb, formatHex],
  ['--card-edge-end', '#0f3a8c', getTintedRgb, formatHex],
  ['--card-rim-start', '#6fb4ff', getTintedRgb, formatHex],
  ['--card-rim-end', '#2f74d8', getTintedRgb, formatHex],
  ['--card-edge-shadow', '#0060e6', getTintedRgb, formatShadow],
  ['--card-inner-light', '#78d6ff', getTintedRgb, formatChannels],
  ['--card-qr-ring', '#0c73d5', getTintedRgb, formatHex],
  ['--card-ticker', '#6ddcff', getAccentRgb, formatHex],
  ['--card-fiat', '#87efff', getAccentRgb, formatHex],
];

const VARIABLE_FORMATS: Record<string, ColorFormat> = {
  ...Object.fromEntries(TINTED_VARIABLES.map(([name, , , format]) => [name, format])),
  [ADDRESS_VARIABLE]: (rgb: Vector) => formatTranslucent(rgb, ADDRESS_ALPHA),
  [GLINT_VARIABLE]: formatChannels,
};

const STOCK_TINTED_OKLCH = TINTED_VARIABLES.map(([, stockColor]) => convertHexToOklch(stockColor));

// The fallbacks of `WalletCard.module.scss`, which a test keeps the same
const STOCK_TINT: WalletCardTint = {
  ...Object.fromEntries(TINTED_VARIABLES.map(([name, stockColor]) => [name, parseHex(stockColor)])),
  [ADDRESS_VARIABLE]: parseHex('#055ac4'),
  [GLINT_VARIABLE]: parseHex('#c8f2ff'),
};

// The card variables in the colors of a backdrop, or the stock ones without it
export function getWalletCardTint(centerColor?: string, edgeColor?: string): WalletCardTint {
  if (!centerColor || !edgeColor) return STOCK_TINT;

  const tint = buildTint(centerColor, edgeColor);
  const surface = convertRgbToOklch(getTintedRgb(tint, STOCK_DARK));
  const isDarkCard = tint.edgeL < DARK_CARD_EDGE_L;
  const colors: WalletCardTint = Object.fromEntries(TINTED_VARIABLES.map(([name, , rule], i) => (
    [name, rule(tint, STOCK_TINTED_OKLCH[i])]
  )));
  colors[ADDRESS_VARIABLE] = getAddressRgb(tint, surface);
  colors[GLINT_VARIABLE] = isDarkCard ? WHITE : convertOklchToRgb({
    l: surface.l * GLINT_L_SCALE, c: surface.c * GLINT_CHROMA_SCALE, h: surface.h,
  });

  return colors;
}

// A theme color in the hue of the backdrop, as the iOS app tints the buttons under the card
export function tintWalletCardColor(hex: string, centerColor?: string, edgeColor?: string) {
  if (!centerColor || !edgeColor) return hex;

  return formatHex(getTintedRgb(buildTint(centerColor, edgeColor), convertHexToOklch(hex)));
}

// The theme shades its accent by mixing it with black
export function shadeWalletCardColor(hex: string, share: number) {
  return formatHex(mapVector(parseHex(hex), (channel) => channel * share));
}

// As in the iOS app, the colors go between the styles in sRGB
export function mixWalletCardTints(from: WalletCardTint, to: WalletCardTint, t: number): WalletCardTint {
  return Object.fromEntries(Object.entries(to).map(([name, color]) => (
    [name, mapVector(from[name], (channel, i) => channel + (color[i] - channel) * t)]
  )));
}

export function formatWalletCardTint(tint: WalletCardTint, names = Object.keys(tint)) {
  return names.map((name) => `${name}: ${VARIABLE_FORMATS[name](tint[name])};`).join(' ');
}

// Sets the variables one by one, so the other inline properties of the element stay
export function applyWalletCardTint(element: HTMLElement, tint?: WalletCardTint) {
  Object.keys(STOCK_TINT).forEach((name) => {
    if (tint) {
      element.style.setProperty(name, VARIABLE_FORMATS[name](tint[name]));
    } else {
      element.style.removeProperty(name);
    }
  });
}

// Item centers form a grid with every other row shifted by half a column, laid out for the 370-wide iOS card. The
// grid stops before `maxX`, where the address column starts.
export function getWalletCardPatternItems(width: number, height: number, maxX = Infinity) {
  const scale = width / IOS_CARD_WIDTH;
  const columnPitch = PATTERN_COLUMN_PITCH * scale;
  const rowPitch = PATTERN_ROW_PITCH * scale;
  const size = Math.floor(PATTERN_ITEM_SIZE * scale);
  if (rowPitch <= 0) return [];

  const centerX = width / 2 + PATTERN_SHIFT_X * scale;
  const centerY = height / 2;
  const rows = Math.ceil(height / 2 / rowPitch) + 1;
  const columns = Math.ceil(width / 2 / columnPitch) + 1;
  const items: WalletCardPatternItem[] = [];

  for (let row = -rows; row <= rows; row++) {
    const shift = row % 2 === 0 ? 0 : columnPitch / 2;
    const y = centerY + row * rowPitch;

    for (let column = -columns; column <= columns; column++) {
      const x = centerX + column * columnPitch + shift;
      if (isBetween(x, -size, Math.min(width + size, maxX)) && isBetween(y, -size, height + size)) {
        items.push({ x, y, size });
      }
    }
  }

  return items;
}

export function convertHexToOklch(hex: string) {
  return convertRgbToOklch(parseHex(hex));
}

export function convertOklchToHex(color: Oklch) {
  return formatHex(convertOklchToRgb(color));
}

function buildTint(centerColor: string, edgeColor: string): Tint {
  const centerRgb = parseHex(centerColor);
  const edgeRgb = parseHex(edgeColor);
  const center = convertRgbToOklch(centerRgb);
  const edge = convertRgbToOklch(edgeRgb);
  const mid = convertRgbToOklch(mapVector(centerRgb, (channel, i) => (channel + edgeRgb[i]) / 2));
  const hueDegrees = (mid.h * DEGREES_PER_RADIAN + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;
  const violet = Math.exp(-(((hueDegrees - VIOLET_HUE) / VIOLET_HUE_SPREAD) ** 2));

  return {
    hue: mid.h,
    chroma: clamp(mid.c * CHROMA_GAIN, MIN_CHROMA_SCALE, 1) * (1 + VIOLET_CHROMA_BOOST * violet),
    cap: center.c * CAP_CHROMA_SCALE,
    darkness: clamp((DARKNESS_START_L - (center.l + edge.l) / 2) / DARKNESS_RANGE_L, 0, 1),
    edgeL: edge.l,
    centerL: center.l,
    darkC: center.c * DARK_CHROMA_SCALE,
    lShift: -VIOLET_L_SHIFT * violet,
  };
}

// A stock color takes the backdrop hue. The darker the backdrop, the closer the color gets to the backdrop's own
// lightness and chroma: its place between the dark and light stock colors maps onto the span from edge to center
function tintStockColor(tint: Tint, stock: Oklch): Oklch {
  const position = clamp(
    (stock.l - STOCK_DARK.l) / (STOCK_LIGHT.l - STOCK_DARK.l), MIN_STOCK_POSITION, MAX_STOCK_POSITION,
  );
  const ownL = tint.edgeL - EDGE_L_OFFSET + position * (tint.centerL - tint.edgeL);
  const l = stock.l + (ownL - stock.l) * tint.darkness + tint.lShift;
  const lightC = Math.min(stock.c * tint.chroma, (tint.cap * stock.c) / CAP_REFERENCE_CHROMA);
  const c = lightC * (1 - tint.darkness) + tint.darkC * tint.darkness;

  return { l: clamp(l, MIN_L, MAX_L), c, h: tint.hue };
}

function getTintedRgb(tint: Tint, stock: Oklch) {
  return convertOklchToRgb(tintStockColor(tint, stock));
}

function getAccentRgb(tint: Tint, stock: Oklch) {
  const color = tintStockColor(tint, stock);

  return convertOklchToRgb({ ...color, l: Math.max(color.l, ACCENT_MIN_L) });
}

function getAddressRgb(tint: Tint, surface: Oklch) {
  if (surface.l < ADDRESS_DARK_SURFACE_L) {
    const accent = convertRgbToOklch(getAccentRgb(tint, STOCK_ACCENT));
    return convertOklchToRgb({ ...accent, l: accent.l * ADDRESS_ACCENT_L_SCALE });
  }

  return convertOklchToRgb({
    l: surface.l - ADDRESS_L_DROP, c: STOCK_ADDRESS.c * tint.chroma * ADDRESS_CHROMA_SCALE, h: tint.hue,
  });
}

function convertRgbToOklch(rgb: Vector): Oklch {
  const [l, c, h] = convertColor({ space: 'srgb', coords: rgb }, 'oklch').coords;

  // `colorjs.io` gives a gray color no hue
  return { l: l!, c: c!, h: (h || 0) / DEGREES_PER_RADIAN };
}

// Out-of-gamut colors lose chroma step by step, keeping their lightness and hue
function convertOklchToRgb({ l, c, h }: Oklch) {
  let chroma = c;
  let linear = convertOklchToLinearRgb(l, chroma, h);
  for (let step = 0; step < GAMUT_MAX_STEPS && linear.some(isOutOfGamut); step++) {
    chroma *= GAMUT_CHROMA_STEP;
    linear = convertOklchToLinearRgb(l, chroma, h);
  }

  const coords = mapVector(linear, (channel) => clamp(channel, 0, 1));

  return toVector(convertColor({ space: 'srgb-linear', coords }, 'srgb').coords);
}

function convertOklchToLinearRgb(l: number, c: number, h: number) {
  return toVector(convertColor({ space: 'oklch', coords: [l, c, h * DEGREES_PER_RADIAN] }, 'srgb-linear').coords);
}

function isOutOfGamut(channel: number) {
  return !isBetween(channel, -GAMUT_TOLERANCE, 1 + GAMUT_TOLERANCE);
}

function parseHex(hex: string) {
  return toVector(buildColorFromHex(hex).coords);
}

function formatHex(rgb: Vector) {
  return buildHexFromColor(buildColor({ space: 'srgb', coords: rgb }));
}

function formatChannels(rgb: Vector) {
  return rgb.map(convertToByte).join(' ');
}

function formatShadow(rgb: Vector) {
  return formatTranslucent(rgb, SHADOW_ALPHA);
}

function formatTranslucent(rgb: Vector, alpha: string) {
  return `rgb(${formatChannels(rgb)} / ${alpha})`;
}

function convertToByte(channel: number) {
  return round(channel * CHANNEL_MAX);
}

function mapVector(vector: Vector, transform: (value: number, index: number) => number): Vector {
  const [a, b, c] = vector.map(transform);

  return [a, b, c];
}

function toVector([a, b, c]: (number | null)[]): Vector {
  return [a!, b!, c!];
}
