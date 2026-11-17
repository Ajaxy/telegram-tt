import type { LayerItem, LayerRect } from './helpers/floatingLayer';

import cycleRestrict from '../../../util/cycleRestrict';
import jsxToHtml from '../../../util/element/jsxToHtml';
import { MAX_WORKERS, requestMediaWorker } from '../../../util/launchMediaWorkers';
import { createStyledQrCode } from '../../../util/qrCode/buildStyledQrCode';
import {
  enumerateEmojiItems, enumerateGiftModels, enumerateGiftSymbols, getIsCoveredByCard,
} from './helpers/floatingLayer';

export const QR_CODE_CARD_MIME_TYPE = 'image/png';

const SVG_MIME_TYPE = 'image/svg+xml';
const QR_LOGO_SIZE = 160;
const EXPORT_SCALE = 3;
const EXPORT_WIDTH = 390;
const EXPORT_HEIGHT = 844;
const EXPORT_CARD_PADDING = 20;
const EXPORT_QR_SIZE = 208;
const EXPORT_USERNAME_GAP = 8;
const EXPORT_USERNAME_HEIGHT = 30;
const EXPORT_CARD_WIDTH = EXPORT_QR_SIZE + 2 * EXPORT_CARD_PADDING;
const EXPORT_CARD_BOTTOM_PADDING = 16;
const EXPORT_CARD_HEIGHT = EXPORT_CARD_PADDING + EXPORT_QR_SIZE + EXPORT_USERNAME_GAP + EXPORT_USERNAME_HEIGHT
  + EXPORT_CARD_BOTTOM_PADDING;
const EXPORT_CARD_RADIUS = 42;
const EXPORT_CARD_X = (EXPORT_WIDTH - EXPORT_CARD_WIDTH) / 2;
const EXPORT_CARD_Y = Math.floor((EXPORT_HEIGHT - EXPORT_CARD_HEIGHT) / 2);
const EXPORT_QR_X = (EXPORT_WIDTH - EXPORT_QR_SIZE) / 2;
const EXPORT_QR_Y = EXPORT_CARD_Y + EXPORT_CARD_PADDING;
const EXPORT_USERNAME_Y = EXPORT_QR_Y + EXPORT_QR_SIZE + EXPORT_USERNAME_GAP;
const USERNAME_MIN_FONT_SIZE = 12;
const WHITE_COLOR = '#ffffff';
const GRADIENT_RADIUS_TO_CARD = 1.6;
const SYMBOL_OPACITY = 0.37;
const EXPORT_AREA: LayerRect = {
  left: 0, top: 0, width: EXPORT_WIDTH, height: EXPORT_HEIGHT,
};
const EXPORT_CARD: LayerRect = {
  left: EXPORT_CARD_X, top: EXPORT_CARD_Y, width: EXPORT_CARD_WIDTH, height: EXPORT_CARD_HEIGHT,
};
const EXPORT_ORIGIN = {
  x: EXPORT_CARD_X + EXPORT_CARD_WIDTH / 2,
  y: EXPORT_CARD_Y + EXPORT_CARD_HEIGHT / 2,
};
const QR_LOGO_PATH = [
  'M80,13c37,0,67,30,67,67s-30,67-67,67s-67-30-67-67S43,13,80,13z',
  'M108.7,51.9h-0.1c-2.5,0-6.4,1.4-24.3,8.8L81.2,62C74,65,61,70.6,42,78.9',
  'c-3.3,1.3-5,2.6-5.2,3.8c-0.3,2.3,2.9,3.1,7,4.4l1.2,0.4c3.5,1.1,7.8,2.3,10.1,2.3',
  'c2.2,0,4.6-0.8,7.2-2.6l9.7-6.5c12.7-8.5,19.4-12.9,20-13.1l0.2-0.1',
  'c0.4-0.1,0.9-0.1,1.2,0.2c0.4,0.4,0.4,1,0.3,1.2c-0.3,1.5-17.8,17.3-19.2,18.7',
  'L74.4,88c-3.8,3.9-7.9,6.3-1.5,10.7l1.5,1c4.8,3.2,8,5.5,12.9,8.7l1.3,0.9',
  'c3.9,2.6,7,5.6,11,5.2c1.8-0.2,3.7-1.9,4.7-6.8l0.1-0.3c2.3-12.3,6.8-39.1,7.9-50.1',
  'c0.1-1,0-2.2-0.1-2.7l0-0.2c-0.1-0.5-0.3-1.2-0.9-1.6C110.5,52.1,109.3,51.9,108.7,51.9z',
].join(' ');

let lastEncodeWorkerIndex = -1;

export type QrPreviewSnapshot = {
  username?: UsernameSnapshot;
  layer: QrLayerSnapshot;
};

export type QrLayerSnapshot = {
  emojiSources: (QrEmojiSource | undefined)[];
  modelSource?: CanvasImageSource;
  symbol?: {
    url: string;
    color: string;
  };
};

export type QrMediaSource = HTMLCanvasElement | HTMLImageElement | HTMLVideoElement;

export type QrEmojiSource = {
  source: QrMediaSource;
  // Text-color emoji are tinted by a CSS filter, which canvas drawing skips
  tintColor?: string;
};

type QrCodeCardParams = {
  link: string;
  inkColor: string;
  gradientStops: string[];
  snapshot: QrPreviewSnapshot;
};

type UsernameSnapshot = {
  text: string;
  style: UsernameStyleSnapshot;
};

type UsernameStyleSnapshot = {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  letterSpacing: string;
  lineHeight: string;
};

export function buildQrPreviewSnapshot(
  layer: QrLayerSnapshot, username?: HTMLElement,
): QrPreviewSnapshot {
  return {
    username: getUsernameSnapshot(username),
    layer,
  };
}

export async function generateQrCodeCard({
  snapshot, link, inkColor, gradientStops,
}: QrCodeCardParams) {
  const blob = await renderQrCodeCard(snapshot, link, inkColor, gradientStops);
  if (!blob) {
    throw new Error('QR_PREVIEW_RENDER_FAILED');
  }

  return blob;
}

async function renderQrCodeCard(
  snapshot: QrPreviewSnapshot, url: string, inkColor: string, gradientStops: string[],
) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return undefined;
  }

  canvas.width = EXPORT_WIDTH * EXPORT_SCALE;
  canvas.height = EXPORT_HEIGHT * EXPORT_SCALE;
  ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0);

  drawThemeBackground(ctx, gradientStops);
  await drawLayer(ctx, snapshot.layer);
  drawCardLayout(ctx, snapshot.username, inkColor);
  await drawQr(ctx, url, inkColor);

  return encodeCanvas(canvas);
}

function getUsernameSnapshot(username?: HTMLElement): UsernameSnapshot | undefined {
  const text = username?.textContent;
  if (!username || !text) return undefined;

  const style = getComputedStyle(username);
  return {
    text,
    style: {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
    },
  };
}

function drawThemeBackground(ctx: CanvasRenderingContext2D, gradientStops: string[]) {
  const gradient = ctx.createRadialGradient(
    EXPORT_ORIGIN.x, EXPORT_ORIGIN.y, 0,
    EXPORT_ORIGIN.x, EXPORT_ORIGIN.y, EXPORT_CARD_WIDTH * GRADIENT_RADIUS_TO_CARD,
  );
  gradientStops.forEach((color, i) => {
    gradient.addColorStop(i / (gradientStops.length - 1), color);
  });

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
}

async function drawLayer(ctx: CanvasRenderingContext2D, layer: QrLayerSnapshot) {
  const { emojiSources, modelSource, symbol } = layer;

  if (symbol) {
    const symbolSource = await loadTintedImage(symbol.url, symbol.color);
    if (symbolSource) {
      ctx.save();
      ctx.globalAlpha = SYMBOL_OPACITY;
      drawLayerItems(ctx, enumerateGiftSymbols(EXPORT_AREA, EXPORT_ORIGIN), () => symbolSource);
      ctx.restore();
    }
  }

  if (modelSource) {
    drawLayerItems(ctx, enumerateGiftModels(EXPORT_AREA, EXPORT_ORIGIN), () => modelSource);
  }

  if (emojiSources.length) {
    const sources = emojiSources.map((emoji) => (
      emoji?.tintColor ? createTintedCanvas(emoji.source, emoji.tintColor) : emoji?.source
    ));
    const items = enumerateEmojiItems(EXPORT_AREA, EXPORT_ORIGIN, emojiSources.length, 0);
    drawLayerItems(ctx, items, (item) => sources[item.pick]);
  }
}

function drawLayerItems(
  ctx: CanvasRenderingContext2D,
  items: LayerItem[],
  getSource: (item: LayerItem) => CanvasImageSource | undefined,
) {
  items.forEach((item) => {
    const source = getSource(item);
    if (!source || getIsCoveredByCard(EXPORT_CARD, item.x, item.y, item.size)) return;

    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.drawImage(source, -item.size / 2, -item.size / 2, item.size, item.size);
    ctx.restore();
  });
}

async function loadTintedImage(url: string, color: string) {
  const image = await loadImage(url).catch(() => undefined);
  return image && createTintedCanvas(image, color);
}

function createTintedCanvas(source: QrMediaSource, color: string) {
  const { width, height } = getMediaSize(source);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0, width, height);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);

  return canvas;
}

function getMediaSize(source: QrMediaSource) {
  if (source instanceof HTMLImageElement) return { width: source.naturalWidth, height: source.naturalHeight };
  if (source instanceof HTMLVideoElement) return { width: source.videoWidth, height: source.videoHeight };
  return { width: source.width, height: source.height };
}

function drawCardLayout(ctx: CanvasRenderingContext2D, username: UsernameSnapshot | undefined, inkColor: string) {
  drawCard(ctx);
  drawUsername(ctx, username, inkColor);
}

function drawCard(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.fillStyle = WHITE_COLOR;
  addRoundRect(ctx, EXPORT_CARD_X, EXPORT_CARD_Y, EXPORT_CARD_WIDTH, EXPORT_CARD_HEIGHT, EXPORT_CARD_RADIUS);
  ctx.fill();
  ctx.restore();
}

function drawUsername(ctx: CanvasRenderingContext2D, username: UsernameSnapshot | undefined, inkColor: string) {
  if (!username) return;

  const { text, style } = username;
  const qrInsetX = (EXPORT_CARD_WIDTH - EXPORT_QR_SIZE) / 2;
  const maxWidth = EXPORT_CARD_WIDTH - Math.floor(qrInsetX * 1.2);
  const fontSize = getFittedFontSize(ctx, text, style, maxWidth);
  const fittedText = getFittedText(ctx, text, maxWidth);

  ctx.save();
  ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = inkColor;
  ctx.fillText(fittedText, EXPORT_WIDTH / 2, EXPORT_USERNAME_Y);
  ctx.restore();
}

async function drawQr(
  ctx: CanvasRenderingContext2D,
  url: string,
  inkColor: string,
) {
  const qrLogoUrl = createQrLogoUrl(inkColor);

  try {
    const exportQrCode = await createStyledQrCode({
      size: EXPORT_QR_SIZE * EXPORT_SCALE,
      margin: 0,
      color: inkColor,
      image: qrLogoUrl,
    });
    exportQrCode.update({ data: url });
    // A vector source avoids an extra PNG encoding and is rasterized at the export scale anyway
    const qrBlob = await exportQrCode.getRawData('svg');
    if (!qrBlob) {
      throw new Error('QR_RASTERIZATION_FAILED');
    }

    const qrUrl = URL.createObjectURL(qrBlob);
    try {
      const image = await loadImage(qrUrl);
      ctx.drawImage(image, EXPORT_QR_X, EXPORT_QR_Y, EXPORT_QR_SIZE, EXPORT_QR_SIZE);
    } finally {
      URL.revokeObjectURL(qrUrl);
    }
  } finally {
    URL.revokeObjectURL(qrLogoUrl);
  }
}

function createQrLogoUrl(color: string) {
  const logoSvgElement = jsxToHtml(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${QR_LOGO_SIZE} ${QR_LOGO_SIZE}`}>
      <path fillRule="evenodd" clipRule="evenodd" fill={color} d={QR_LOGO_PATH} />
    </svg>,
  )[0];

  return URL.createObjectURL(new Blob([logoSvgElement.outerHTML], { type: SVG_MIME_TYPE }));
}

function getFittedFontSize(
  ctx: CanvasRenderingContext2D, text: string, style: UsernameStyleSnapshot, maxWidth: number,
) {
  let fontSize = parseFloat(style.fontSize || '0');
  while (fontSize > USERNAME_MIN_FONT_SIZE) {
    ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) {
      return fontSize;
    }
    fontSize -= 1;
  }
  ctx.font = `${style.fontWeight} ${USERNAME_MIN_FONT_SIZE}px ${style.fontFamily}`;
  return USERNAME_MIN_FONT_SIZE;
}

function getFittedText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  const ellipsis = '...';
  let result = text;
  while (result && ctx.measureText(`${result}${ellipsis}`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}${ellipsis}`;
}

function addRoundRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number,
) {
  const normalizedRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + normalizedRadius, y);
  ctx.lineTo(x + width - normalizedRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + normalizedRadius);
  ctx.lineTo(x + width, y + height - normalizedRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - normalizedRadius, y + height);
  ctx.lineTo(x + normalizedRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - normalizedRadius);
  ctx.lineTo(x, y + normalizedRadius);
  ctx.quadraticCurveTo(x, y, x + normalizedRadius, y);
  ctx.closePath();
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

// Encoding on the main thread waits for idle time, which the modal animations rarely leave
async function encodeCanvas(canvas: HTMLCanvasElement) {
  try {
    const imageBitmap = await createImageBitmap(canvas);
    const { blob } = await requestMediaWorker({
      name: 'offscreen-canvas:encodeImage',
      args: [imageBitmap, QR_CODE_CARD_MIME_TYPE],
      transferables: [imageBitmap],
    }, cycleRestrict(MAX_WORKERS, ++lastEncodeWorkerIndex));

    return blob;
  } catch {
    return canvasToBlob(canvas);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | undefined>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => resolve(blob || undefined), QR_CODE_CARD_MIME_TYPE);
    } catch (err) {
      reject(err);
    }
  });
}
