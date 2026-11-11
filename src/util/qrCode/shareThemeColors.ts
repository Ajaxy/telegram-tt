// Adapted from https://github.com/telegramdesktop/tdesktop/blob/dev/Telegram/SourceFiles/ui/effects/peer_qr_surface.cpp

import { clamp } from '../math';

type Rgb = [number, number, number];
type Lab = [number, number, number];

export type QrThemeColors = {
  ink: string;
  foreground: string;
  control: string;
  wave: string;
  gradientStops: string[];
};

const RGB_CHANNEL_MAX = 255;
const INK_CONTRAST = 4.4;
const FOREGROUND_CONTRAST = 4.5;
const INK_CHROMA_SCALE = 1.25;
const INK_CHROMA_ADD = 0.02;
const INK_CHROMA_MAX = 0.2;
const DARK_INK_GLASS_ALPHA = 0.35;
const WHITE_GLYPH_GLASS_ALPHA = 0.12;
const WHITE_GLYPH_CONTRAST = 3;
const GRADIENT_STEPS = 8;
const GRADIENT_MIDDLE_MIX = 0.5;
const WAVE_WHITE_MIX = 0.55;
const DARK_EDGE_FROM = 7;
const DARK_EDGE_TILL = 11;
const DARK_INK_CONTRAST = 2.3;
const SOLVE_ITERATIONS = 24;
const GAMUT_ITERATIONS = 30;
const GAMUT_EPSILON = 1e-4;
const WHITE: Rgb = [RGB_CHANNEL_MAX, RGB_CHANNEL_MAX, RGB_CHANNEL_MAX];

export const DEFAULT_SHARE_THEME_CENTER_COLOR = '#363738';
export const DEFAULT_SHARE_THEME_EDGE_COLOR = '#0e0f0f';

export function computeQrThemeColors(centerHex: string, edgeHex: string): QrThemeColors {
  const center = parseHex(centerHex);
  const edge = parseHex(edgeHex);
  const edgeLab = toLab(edge);
  const hue = getHue(edgeLab);
  const reference = mixLab(center, edge, GRADIENT_MIDDLE_MIX);
  const darkest = [center, reference, edge].reduce((result, color) => (
    countContrast(color, WHITE) > countContrast(result, WHITE) ? color : result
  ));
  const dark = solveLightness(hue, getInkChroma(getChroma(edgeLab)), darkest, FOREGROUND_CONTRAST);

  const whiteContrast = countContrast(WHITE, mixRgb(reference, WHITE, WHITE_GLYPH_GLASS_ALPHA));
  const hasWhiteGlyphs = whiteContrast >= WHITE_GLYPH_CONTRAST
    || whiteContrast >= countContrast(dark, mixRgb(reference, WHITE, DARK_INK_GLASS_ALPHA));

  const gradientStops: string[] = [];
  for (let i = 0; i <= GRADIENT_STEPS; i++) {
    gradientStops.push(serializeHex(mixLab(center, edge, i / GRADIENT_STEPS)));
  }

  return {
    ink: serializeHex(computeInk(center, edge)),
    foreground: serializeHex(hasWhiteGlyphs ? WHITE : dark),
    control: `rgba(255, 255, 255, ${hasWhiteGlyphs ? WHITE_GLYPH_GLASS_ALPHA : DARK_INK_GLASS_ALPHA})`,
    wave: serializeHex(mixLab(center, WHITE, WAVE_WHITE_MIX)),
    gradientStops,
  };
}

function computeInk(center: Rgb, edge: Rgb) {
  const edgeLab = toLab(edge);
  const hue = getHue(edgeLab);
  const shipped = solveLightness(hue, getInkChroma(getChroma(edgeLab)), WHITE, INK_CONTRAST);
  const darkness = clamp((countContrast(edge, WHITE) - DARK_EDGE_FROM) / (DARK_EDGE_TILL - DARK_EDGE_FROM), 0, 1);
  if (darkness <= 0) return shipped;

  // Dark neutral backdrops get an ink darker than their center
  const shade = solveLightness(hue, getChroma(edgeLab), center, DARK_INK_CONTRAST);
  if (countContrast(shade, WHITE) <= countContrast(shipped, WHITE)) return shipped;

  return darkness >= 1 ? shade : mixLab(shipped, shade, darkness);
}

function getInkChroma(chroma: number) {
  return Math.min(chroma * INK_CHROMA_SCALE + INK_CHROMA_ADD, INK_CHROMA_MAX);
}

function solveLightness(hue: number, chroma: number, against: Rgb, contrast: number) {
  let from = 0;
  let till = toLab(against)[0];
  for (let i = 0; i < SOLVE_ITERATIONS; i++) {
    const middle = (from + till) / 2;
    if (countContrast(fromLch(middle, chroma, hue), against) >= contrast) {
      from = middle;
    } else {
      till = middle;
    }
  }

  return fromLch(from, chroma, hue);
}

function mixLab(a: Rgb, b: Rgb, ratio: number) {
  const from = toLab(a);
  const till = toLab(b);
  const lab = from.map((value, i) => value + (till[i] - value) * ratio) as Lab;
  return fromLch(lab[0], getChroma(lab), getHue(lab));
}

function mixRgb(a: Rgb, b: Rgb, ratio: number) {
  return a.map((value, i) => value + (b[i] - value) * ratio) as Rgb;
}

function countContrast(a: Rgb, b: Rgb) {
  const luminanceA = getLuminance(a);
  const luminanceB = getLuminance(b);
  return (Math.max(luminanceA, luminanceB) + 0.05) / (Math.min(luminanceA, luminanceB) + 0.05);
}

function getLuminance([r, g, b]: Rgb) {
  return toLinear(r) * 0.2126 + toLinear(g) * 0.7152 + toLinear(b) * 0.0722;
}

function toLinear(channel: number) {
  const value = channel / RGB_CHANNEL_MAX;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function fromLinear(value: number) {
  const clamped = clamp(value, 0, 1);
  return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

// OKLab, see https://bottosson.github.io/posts/oklab/
function toLab([red, green, blue]: Rgb): Lab {
  const r = toLinear(red);
  const g = toLinear(green);
  const b = toLinear(blue);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

function linearFromLch(lightness: number, chroma: number, hue: number): Rgb {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.2914855480 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

function isInGamut(lightness: number, chroma: number, hue: number) {
  return linearFromLch(lightness, chroma, hue).every((value) => (
    value >= -GAMUT_EPSILON && value <= 1 + GAMUT_EPSILON
  ));
}

// Out-of-gamut colors keep their lightness and hue, losing chroma
function fromLch(lightness: number, chroma: number, hue: number): Rgb {
  let fittedChroma = chroma;
  if (!isInGamut(lightness, chroma, hue)) {
    let low = 0;
    let high = chroma;
    for (let i = 0; i < GAMUT_ITERATIONS; i++) {
      const middle = (low + high) / 2;
      if (isInGamut(lightness, middle, hue)) {
        low = middle;
      } else {
        high = middle;
      }
    }
    fittedChroma = low;
  }

  return linearFromLch(lightness, fittedChroma, hue)
    .map((value) => Math.round(fromLinear(value) * RGB_CHANNEL_MAX)) as Rgb;
}

function getChroma([, a, b]: Lab) {
  return Math.hypot(a, b);
}

function getHue([, a, b]: Lab) {
  const hue = ((Math.atan2(b, a) * 180) / Math.PI) % 360;
  return hue < 0 ? hue + 360 : hue;
}

function parseHex(hex: string): Rgb {
  const value = parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function serializeHex(rgb: Rgb) {
  return `#${rgb.map((channel) => Math.round(clamp(channel, 0, RGB_CHANNEL_MAX))
    .toString(16).padStart(2, '0')).join('')}`;
}
