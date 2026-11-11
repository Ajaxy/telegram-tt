import { buildColor, type Color, convertColor, getLuminance, mixColors, serializeColor } from '../lib/color';
import { preloadImage } from './files';

const LUMA_THRESHOLD = 128;
const RGB_CHANNEL_MAX = 255;
const COLOR_PERCENT_MAX = 100;
const AVERAGE_COLOR_BLOCK_SIZE = 5;
const IMAGE_EDGE_SAMPLE_COUNT = 16;
const IMAGE_EDGE_INSET = 5;
const IMAGE_EDGE_SAMPLE_HEIGHT = 2;
const IMAGE_PIXEL_CHANNEL_COUNT = 4;
const IMAGE_RGB_CHANNEL_COUNT = 3;
const IMAGE_COLOR_BUCKET_SIZE = 32;
const OUTGOING_COLOR_BLEND_WEIGHT = 0.5;
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

export function sampleImageEdgeColors(image: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_EDGE_SAMPLE_COUNT;
  canvas.height = IMAGE_EDGE_SAMPLE_HEIGHT;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return undefined;

  const { naturalWidth: width, naturalHeight: height } = image;
  const edgeInset = Math.min(IMAGE_EDGE_INSET, Math.floor((height - 1) / IMAGE_EDGE_SAMPLE_HEIGHT));
  try {
    for (let index = 0; index < IMAGE_EDGE_SAMPLE_COUNT; index++) {
      const x = Math.round(index * (width - 1) / (IMAGE_EDGE_SAMPLE_COUNT - 1));
      context.drawImage(image, x, edgeInset, 1, 1, index, 0, 1, 1);
      context.drawImage(image, x, height - 1 - edgeInset, 1, 1, index, 1, 1, 1);
    }
    const { data } = context.getImageData(0, 0, IMAGE_EDGE_SAMPLE_COUNT, IMAGE_EDGE_SAMPLE_HEIGHT);
    const colors = [0, 1].map((row) => {
      const groups = new Map<string, { count: number; color: string }>();
      for (let index = 0; index < IMAGE_EDGE_SAMPLE_COUNT; index++) {
        const offset = (row * IMAGE_EDGE_SAMPLE_COUNT + index) * IMAGE_PIXEL_CHANNEL_COUNT;
        const channels = Array.from(data.subarray(offset, offset + IMAGE_RGB_CHANNEL_COUNT));
        // Group similar shades so small variations don't split the prevalent color
        const key = channels.map((value) => Math.floor(value / IMAGE_COLOR_BUCKET_SIZE)).join(',');
        const group = groups.get(key);
        if (group) {
          group.count += 1;
        } else {
          groups.set(key, { count: 1, color: `rgb(${channels.join(', ')})` });
        }
      }
      return Array.from(groups.values()).sort((a, b) => b.count - a.count)[0].color;
    });
    return { top: colors[0], bottom: colors[1] };
  } catch {
    return undefined;
  }
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

export function mixAverageColor(hexColors: string[]) {
  return hexColors.map(buildColorFromHex)
    .reduce((average, color, i) => mixColors(average, color, 1 / (i + 1), { space: 'srgb' }));
}

// Re-expresses a tint at another alpha, keeping its composite over the average backdrop color unchanged
export function buildDenseTint(tintHex: string, backdropHexColors: string[], alpha: number) {
  if (!backdropHexColors.length) return tintHex;

  const tint = buildColorFromHex(tintHex);
  const tintAlpha = tint.alpha ?? 1;
  const backdrop = mixAverageColor(backdropHexColors);
  // A ratio above 1 extrapolates away from the backdrop, so a lower alpha still reaches an opaque tint
  const denseTint = mixColors(backdrop, { ...tint, alpha: 1 }, tintAlpha / alpha, { space: 'srgb' });

  return serializeColor({ ...denseTint, alpha }, { format: 'hex', collapse: false, alpha: true });
}

// Adapted from Telegram iOS `serviceColor(with:)`
export function getServiceColor(color: Color) {
  const [h, s, v] = convertColor(color, 'hsv').coords.map((coord) => coord || 0);
  const saturation = s ? Math.min(COLOR_PERCENT_MAX, s + 5 + 0.1 * (COLOR_PERCENT_MAX - s)) : 0;

  return serializeColor({
    space: 'hsv',
    coords: [h, saturation, v * 0.65],
    alpha: 102 / RGB_CHANNEL_MAX,
  }, { format: 'hex', collapse: false, alpha: true });
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

export function deriveOutgoingBubbleFill(messageColors: string[]): string | undefined {
  if (!messageColors.length) return undefined;
  if (messageColors.every((color) => color.toLowerCase() === messageColors[0].toLowerCase())) {
    return messageColors[0];
  }

  const blended = messageColors.map(buildColorFromHex).reduce((fill, color) => (
    mixColors(fill, color, OUTGOING_COLOR_BLEND_WEIGHT, { space: 'srgb' })
  ));
  return buildHexFromColor(blended);
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
