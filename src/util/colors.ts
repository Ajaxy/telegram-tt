import { buildColor, type Color, convertColor, getLuminance, mixColors, serializeColor } from '../lib/color';
import { preloadImage } from './files';

const LUMA_THRESHOLD = 128;
const RGB_CHANNEL_MAX = 255;
const COLOR_PERCENT_MAX = 100;
const AVERAGE_COLOR_BLOCK_SIZE = 5;
const IMAGE_DATA_OPTIONS: ImageDataSettings[] = [
  { colorSpace: 'display-p3', pixelFormat: 'rgba-float16' },
  { colorSpace: 'display-p3' },
  { colorSpace: 'srgb', pixelFormat: 'rgba-float16' },
  { colorSpace: 'srgb' },
];

export async function getAverageColor(url: string): Promise<Color> {
  const image = await preloadImage(url);
  const height = image.naturalHeight || image.offsetHeight || image.height;
  const width = image.naturalWidth || image.offsetWidth || image.width;

  for (const options of IMAGE_DATA_OPTIONS) {
    const color = getAverageColorForOptions(image, width, height, options);
    if (color) return color;
  }

  return buildFallbackColor();
}

export function getColorLuma(color: Color) {
  return getLuminance(color) * RGB_CHANNEL_MAX;
}

export function convertSrgbChannel(channel: number | null) {
  return Math.round((channel || 0) * RGB_CHANNEL_MAX);
}

export function buildColorFromHex(hex: string) {
  return buildColor(hex.startsWith('#') ? hex : `#${hex}`);
}

export function buildHexFromColor(color: Color) {
  return serializeColor(color, { format: 'hex', collapse: false, alpha: false });
}

// Function was adapted from https://github.com/telegramdesktop/tdesktop/blob/35ff621b5b52f7e3553fb0f990ea13ade7101b8e/Telegram/SourceFiles/data/data_wall_paper.cpp#L518
export function getPatternColor(color: Color) {
  const [h, initialS, initialV] = convertColor(color, 'hsv').coords;
  let s = initialS! / COLOR_PERCENT_MAX;
  let v = initialV! / COLOR_PERCENT_MAX;

  s = Math.min(1, s + 0.05 + 0.1 * (1 - s));
  v = v > 0.5
    ? Math.max(0, v * 0.65)
    : Math.max(0, Math.min(1, 1 - v * 0.65));

  return serializeColor({
    space: 'hsv',
    coords: [h || 0, s * COLOR_PERCENT_MAX, v * COLOR_PERCENT_MAX],
    alpha: 102 / RGB_CHANNEL_MAX,
  }, { format: 'hex', collapse: false, alpha: true });
}

// Raises the alpha of a translucent tint, keeping its composite over the average backdrop color unchanged
export function buildDenseTint(tintHex: string, backdropHexColors: string[], alpha: number) {
  const tint = buildColorFromHex(tintHex);
  if (tint.alpha! >= alpha) return tintHex;

  const backdrop = backdropHexColors.map(buildColorFromHex)
    .reduce((average, color, i) => mixColors(average, color, 1 / (i + 1), { space: 'srgb' }), tint);
  const denseTint = mixColors(backdrop, tint, tint.alpha! / alpha, { space: 'srgb' });
  denseTint.alpha = alpha;

  return serializeColor(denseTint, { format: 'hex', collapse: false, alpha: true });
}

export function int2cssRgba(color: number): string {
  const alpha = (color >> 24) & 0xff;
  const red = (color >> 16) & 0xff;
  const green = (color >> 8) & 0xff;
  const blue = color & 0xff;
  const alphaFloat = alpha / 255;

  return `rgba(${red}, ${green}, ${blue}, ${alphaFloat})`;
}

export function getTextColor(color: number): string {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const colorInstance = buildColor({
    space: 'srgb',
    coords: [
      r / RGB_CHANNEL_MAX,
      g / RGB_CHANNEL_MAX,
      b / RGB_CHANNEL_MAX,
    ],
  });
  const luma = getColorLuma(colorInstance);
  return luma > LUMA_THRESHOLD ? 'black' : 'white';
}

function getAverageColorForOptions(
  image: HTMLImageElement,
  width: number,
  height: number,
  options: ImageDataSettings,
) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', {
    colorSpace: options.colorSpace,
    willReadFrequently: true,
  });
  if (!context) return undefined;

  canvas.height = height;
  canvas.width = width;
  context.drawImage(image, 0, 0);

  try {
    return buildAverageColor(context.getImageData(0, 0, width, height, options));
  } catch {
    return undefined;
  }
}

function buildAverageColor(imageData: ImageData) {
  const { data } = imageData;
  const colorSpace = imageData.colorSpace === 'display-p3' ? 'p3' : 'srgb';
  const channelMax = data instanceof Uint8ClampedArray ? RGB_CHANNEL_MAX : 1;
  const rgb = [0, 0, 0];
  let count = 0;
  let i = -4;

  while ((i += AVERAGE_COLOR_BLOCK_SIZE * 4) < data.length) {
    if (data[i + 3] === 0) continue; // Ignore fully transparent pixels
    count += 1;
    rgb[0] += data[i] / channelMax;
    rgb[1] += data[i + 1] / channelMax;
    rgb[2] += data[i + 2] / channelMax;
  }

  if (!count) return buildFallbackColor();

  return buildColor({
    space: colorSpace,
    coords: [
      rgb[0] / count,
      rgb[1] / count,
      rgb[2] / count,
    ],
  });
}

function buildFallbackColor() {
  return buildColor({ space: 'srgb', coords: [0, 0, 0] });
}
