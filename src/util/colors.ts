import { preloadImage } from './files';
import { clamp, lerp } from './math.ts';

const LUMA_THRESHOLD = 128;

type Number3 = [number, number, number];
type Number4 = [number, number, number, number];
type Rgba = {
  r: number;
  g: number;
  b: number;
  a?: number;
};

function clearHex(hex: string) {
  return hex.length % 2 === 0 ? hex : hex.slice(1);
}

/**
 * HEX > RGB
 * input: 'xxxxxx' (ex. 'ed15fa') case-insensitive
 * output: [r, g, b] ([0-255, 0-255, 0-255])
 */
export function hex2rgb(hex: string): Number3 {
  const cleanHex = clearHex(hex);

  return [
    parseInt(cleanHex.substring(0, 2), 16),
    parseInt(cleanHex.substring(2, 4), 16),
    parseInt(cleanHex.substring(4, 6), 16),
  ];
}

export function hex2rgba(hex: string): Number4 {
  const cleanHex = clearHex(hex);

  return [
    ...hex2rgb(cleanHex),
    cleanHex.length === 8 ? parseInt(cleanHex.substring(6, 8), 16) : 255,
  ];
}

export function hex2rgbaObj(hex: string): Rgba {
  const [r, g, b, a] = hex2rgba(hex);

  return { r, g, b, a };
}

export function rgb2hex([r, g, b]: Number3) {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function rgba2hex([r, g, b, a]: Number4) {
  return `${rgb2hex([r, g, b])}${a.toString(16)}`;
}

/**
 * Converts an RGB color value to HSV. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and v in the set [0, 1].
 *
 * @param   Number  r       The red color value
 * @param   Number  g       The green color value
 * @param   Number  b       The blue color value
 * @return  Array           The HSV representation
 */
export function rgb2hsv([r, g, b]: Number3): Number3 {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h!: number;
  const s: number = max === 0 ? 0 : d / max;
  const v: number = max;

  if (max === min) {
    h = 0; // achromatic
  } else {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }

    h /= 6;
  }

  return [h, s, v];
}

export function rgba2hsva([r, g, b, a]: Number4): Number4 {
  return [...rgb2hsv([r, g, b]), a];
}

/**
 * Converts an HSV color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
 * Assumes h, s, and v are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   Number  h       The hue
 * @param   Number  s       The saturation
 * @param   Number  v       The value
 * @return  Array           The RGB representation
 */
export function hsv2rgb([h, s, v]: Number3): Number3 {
  let r!: number, g!: number, b!: number;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }

  return [
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(b * 255),
  ];
}

export function hsva2rgba([h, s, v, a]: Number4): Number4 {
  return [...hsv2rgb([h, s, v]), a];
}

export async function getAverageColor(url: string): Promise<Number3> {
  // Only visit every 5 pixels
  const blockSize = 5;
  const black: Number3 = [0, 0, 0];
  let data;
  let i = -4;
  const rgb: Number3 = [0, 0, 0];
  let count = 0;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext && canvas.getContext('2d');
  if (!context) {
    return black;
  }

  const image = await preloadImage(url);
  const height = image.naturalHeight || image.offsetHeight || image.height;
  const width = image.naturalWidth || image.offsetWidth || image.width;
  canvas.height = height;
  canvas.width = width;

  context.drawImage(image, 0, 0);

  try {
    data = context.getImageData(0, 0, width, height);
  } catch (e) {
    return black;
  }

  const length = data.data.length;

  while ((i += blockSize * 4) < length) {
    if (data.data[i + 3] === 0) continue; // Ignore fully transparent pixels
    ++count;
    rgb[0] += data.data[i];
    rgb[1] += data.data[i + 1];
    rgb[2] += data.data[i + 2];
  }

  rgb[0] = Math.floor(rgb[0] / count);
  rgb[1] = Math.floor(rgb[1] / count);
  rgb[2] = Math.floor(rgb[2] / count);

  return rgb;
}

export function getColorLuma([r, g, b]: Number3) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// https://stackoverflow.com/a/64090995
export function hsl2rgb([h, s, l]: Number3): Number3 {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number, k = (n + h / 30) % 12) => l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);

  return [f(0), f(8), f(4)];
}

// Function was adapted from https://github.com/telegramdesktop/tdesktop/blob/35ff621b5b52f7e3553fb0f990ea13ade7101b8e/Telegram/SourceFiles/data/data_wall_paper.cpp#L518
export function getPatternColor(rgb: Number3) {
  const hsv = rgb2hsv(rgb);
  const [h] = hsv;
  let [, s, v] = hsv;

  s = Math.min(1, s + 0.05 + 0.1 * (1 - s));
  v = v > 0.5
    ? Math.max(0, v * 0.65)
    : Math.max(0, Math.min(1, 1 - v * 0.65));

  const newRgb = hsv2rgb([h, s, v]);

  return rgba2hex([...newRgb, 102]);
}

export function int2cssRgba(color: number): string {
  const alpha = (color >> 24) & 0xff;
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;
  const alphaFloat = alpha / 255;

  return `rgba(${red}, ${green}, ${blue}, ${alphaFloat})`;
}

export function int2hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function getTextColor(color: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const luma = getColorLuma([r, g, b]);
  return luma > LUMA_THRESHOLD ? 'black' : 'white';
}

export function lerpRgbaObj(start: Rgba, end: Rgba, interpolationRatio: number): Rgba {
  const r = Math.round(lerp(start.r, end.r, interpolationRatio));
  const g = Math.round(lerp(start.g, end.g, interpolationRatio));
  const b = Math.round(lerp(start.b, end.b, interpolationRatio));
  const a = start.a !== undefined
    ? Math.round(lerp(start.a, end.a!, interpolationRatio))
    : undefined;

  return { r, g, b, a };
}

export function adjustHsv(hex: string, satDelta: number, valDelta: number) {
  const hsva = rgba2hsva(hex2rgba(hex));
  const [h, , , a] = hsva;
  let [, s, v] = hsva;

  if (s > 0.1 && s < 0.9) s = clamp(s + satDelta, 0, 1);
  v = clamp(v + valDelta, 0, 1);

  return rgba2hex(hsva2rgba([h, s, v, a]));
}
