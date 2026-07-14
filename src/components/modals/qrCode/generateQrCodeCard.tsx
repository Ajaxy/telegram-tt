import type { QrGradientStops } from '../../../util/qrCode/buildStyledQrCode';

import jsxToHtml from '../../../util/element/jsxToHtml';
import { createStyledQrCode } from '../../../util/qrCode/buildStyledQrCode';

import backgroundStyles from '../../../styles/_patternBackground.module.scss';
import styles from './QrCodeModal.module.scss';

export const QR_CODE_CARD_MIME_TYPE = 'image/png';

const SVG_MIME_TYPE = 'image/svg+xml';
const QR_LOGO_SIZE = 160;
const EXPORT_SCALE = 3;
const EXPORT_WIDTH = 390;
const EXPORT_HEIGHT = 844;
const EXPORT_CARD_WIDTH = 300;
const EXPORT_CARD_HEIGHT = 330;
const EXPORT_CARD_RADIUS = 42;
const EXPORT_AVATAR_SIZE = 100;
const EXPORT_AVATAR_RADIUS = EXPORT_AVATAR_SIZE / 2;
const EXPORT_AVATAR_OVERHANG = Math.floor(EXPORT_AVATAR_SIZE * 0.7);
const EXPORT_CARD_X = (EXPORT_WIDTH - EXPORT_CARD_WIDTH) / 2;
const EXPORT_CARD_Y = Math.floor((EXPORT_HEIGHT - EXPORT_CARD_HEIGHT) / 2);
const EXPORT_AVATAR_X = EXPORT_WIDTH / 2;
const EXPORT_AVATAR_Y = EXPORT_CARD_Y - EXPORT_AVATAR_OVERHANG + EXPORT_AVATAR_RADIUS;
const EXPORT_QR_SIZE = 220;
const EXPORT_QR_X = (EXPORT_WIDTH - EXPORT_QR_SIZE) / 2;
const EXPORT_QR_Y = EXPORT_CARD_Y + 50;
const EXPORT_USERNAME_Y = EXPORT_QR_Y + EXPORT_QR_SIZE + 20;
const AVATAR_RING_WIDTH = 4;
const AVATAR_FONT_SIZE_RATIO_FALLBACK = 2;
const PATTERN_SIZE = 430;
const USERNAME_MIN_FONT_SIZE = 12;
const DEFAULT_WALLPAPER_COLOR = '#3390ec';
const WHITE_COLOR = '#ffffff';
const TRANSPARENT_COLOR = 'rgba(0, 0, 0, 0)';
const DARK_PATTERN_GRADIENT_COLORS = ['#4f5bd5', '#962fbf', '#dd6cb9', '#fec496'];
const DARK_PATTERN_GRADIENT_ANGLE = 145;
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

export type QrPreviewSnapshot = {
  backgroundColor: string;
  backgroundImageStyle?: BackgroundImageRenderStyle;
  patternStyle?: PatternRenderStyle;
  username?: UsernameSnapshot;
  avatar?: AvatarSnapshot;
};

type QrCodeCardParams = {
  link: string;
  gradient: QrGradientStops;
  snapshot: QrPreviewSnapshot;
};

type BackgroundImageRenderStyle = {
  backgroundImage: string;
  display: string;
  filter: string;
  transform: string;
};

type PatternRenderStyle = {
  backgroundImage: string;
  maskImage: string;
  display: string;
  content: string;
  opacity: string;
};

type UsernameSnapshot = {
  text: string;
  style: UsernameStyleSnapshot;
};

type UsernameStyleSnapshot = {
  backgroundImage: string;
  color: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  letterSpacing: string;
  lineHeight: string;
};

type AvatarSnapshot = {
  backgroundColor: string;
  backgroundImage: string;
  color: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  size: number;
  imageSrc?: string;
  text?: string;
};

export function getQrPreviewSnapshot(wallpaper: HTMLElement): QrPreviewSnapshot | undefined {
  const card = wallpaper.querySelector<HTMLElement>(`.${styles.card}`);
  if (!card) {
    return undefined;
  }

  const background = wallpaper.querySelector<HTMLElement>(`.${backgroundStyles.background}`);
  const wallpaperStyle = getComputedStyle(wallpaper);
  const backgroundStyle = background ? getComputedStyle(background) : undefined;
  const themeBackgroundColor = wallpaperStyle.getPropertyValue('--theme-background-color').trim();
  const beforeStyle = background ? getComputedStyle(background, '::before') : undefined;
  const afterStyle = background ? getComputedStyle(background, '::after') : undefined;

  return {
    backgroundColor: getCanvasBackgroundColor(themeBackgroundColor, backgroundStyle?.backgroundColor),
    backgroundImageStyle: beforeStyle ? getBackgroundImageRenderStyle(beforeStyle) : undefined,
    patternStyle: afterStyle ? getPatternRenderStyle(afterStyle) : undefined,
    username: getUsernameSnapshot(wallpaper),
    avatar: getAvatarSnapshot(card),
  };
}

export async function generateQrCodeCard({
  snapshot, link, gradient,
}: QrCodeCardParams) {
  const blob = await renderQrCodeCard(snapshot, link, gradient);
  if (!blob) {
    throw new Error('QR_PREVIEW_RENDER_FAILED');
  }

  return blob;
}

export function logQrRenderError(error: unknown) {
  // eslint-disable-next-line no-console
  console.error('[QrCodeModal] export render failed', formatQrRenderError(error));
}

async function renderQrCodeCard(
  snapshot: QrPreviewSnapshot, url: string, gradient: QrGradientStops,
) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return undefined;
  }

  canvas.width = EXPORT_WIDTH * EXPORT_SCALE;
  canvas.height = EXPORT_HEIGHT * EXPORT_SCALE;
  ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0);

  await drawWallpaper(ctx, snapshot, EXPORT_WIDTH, EXPORT_HEIGHT);
  drawCardLayout(ctx, snapshot.username);
  await drawAvatar(ctx, snapshot.avatar);
  await drawQr(ctx, url, gradient);

  const blob = await canvasToBlob(canvas);

  return blob;
}

function getBackgroundImageRenderStyle(style: CSSStyleDeclaration): BackgroundImageRenderStyle {
  return {
    backgroundImage: style.backgroundImage,
    display: style.display,
    filter: style.filter,
    transform: style.transform,
  };
}

function getPatternRenderStyle(style: CSSStyleDeclaration): PatternRenderStyle {
  return {
    backgroundImage: style.backgroundImage,
    maskImage: style.maskImage,
    display: style.display,
    content: style.content,
    opacity: style.opacity,
  };
}

function getUsernameSnapshot(wallpaper: HTMLElement): UsernameSnapshot | undefined {
  const username = wallpaper.querySelector<HTMLElement>(`.${styles.username}`);
  const text = username?.textContent;
  if (!username || !text) return undefined;

  const style = getComputedStyle(username);
  return {
    text,
    style: {
      backgroundImage: style.backgroundImage,
      color: style.color,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
    },
  };
}

function getAvatarSnapshot(card: HTMLElement): AvatarSnapshot | undefined {
  const avatar = card.querySelector<HTMLElement>('.Avatar');
  if (!avatar) return undefined;

  const imageEl = avatar.querySelector<HTMLImageElement>('img.avatar-media');
  const inner = avatar.querySelector<HTMLElement>('.inner');
  const backgroundStyle = inner ? getComputedStyle(inner) : getComputedStyle(avatar);
  const textStyle = getComputedStyle(avatar);
  const text = avatar.textContent?.trim();

  return {
    backgroundColor: backgroundStyle.backgroundColor,
    backgroundImage: backgroundStyle.backgroundImage,
    color: textStyle.color,
    fontFamily: textStyle.fontFamily,
    fontSize: textStyle.fontSize,
    fontWeight: textStyle.fontWeight,
    size: avatar.offsetWidth,
    imageSrc: imageEl?.src,
    text,
  };
}

async function drawWallpaper(
  ctx: CanvasRenderingContext2D,
  snapshot: QrPreviewSnapshot,
  width: number,
  height: number,
) {
  ctx.fillStyle = snapshot.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  if (snapshot.backgroundImageStyle) {
    await drawBackgroundImage(ctx, snapshot.backgroundImageStyle, width, height);
  }

  if (snapshot.patternStyle) {
    await drawPattern(ctx, snapshot.patternStyle, width, height);
  }
}

async function drawBackgroundImage(
  ctx: CanvasRenderingContext2D,
  style: BackgroundImageRenderStyle,
  width: number,
  height: number,
) {
  const imageUrl = getCssUrl(style.backgroundImage);
  if (!imageUrl || style.display === 'none') return;

  const image = await loadImage(imageUrl).catch(() => undefined);
  if (!image) return;

  drawTransformedImageCover(ctx, image, style, 0, 0, width, height);
}

function drawTransformedImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  style: BackgroundImageRenderStyle,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const hasFilter = Boolean(style.filter && style.filter !== 'none');
  const hasTransform = Boolean(style.transform && style.transform !== 'none');
  if (!hasFilter && !hasTransform) {
    drawImageCover(ctx, image, x, y, width, height);
    return;
  }

  ctx.save();
  applyCssTransform(ctx, style.transform, x, y, width, height);
  if (hasFilter) {
    ctx.filter = style.filter;
  }
  drawImageCover(ctx, image, x, y, width, height);
  ctx.restore();
}

async function drawPattern(
  ctx: CanvasRenderingContext2D,
  style: PatternRenderStyle,
  width: number,
  height: number,
) {
  if (style.display === 'none' || style.content === 'none') return;

  const backgroundImageUrl = getCssUrl(style.backgroundImage);
  const maskImageUrl = getCssUrl(style.maskImage);
  if (!backgroundImageUrl && maskImageUrl) {
    await drawMaskedPatternLayer(ctx, style, maskImageUrl, width, height);
    return;
  }

  if (!backgroundImageUrl) {
    return;
  }

  const image = await loadImage(backgroundImageUrl).catch(() => undefined);
  if (!image) return;

  const patternCanvas = createPatternCanvas(image, width, height);
  if (!patternCanvas) return;

  ctx.save();
  ctx.globalAlpha = getStyleOpacity(style.opacity);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.drawImage(patternCanvas, 0, 0, width, height);
  ctx.restore();
}

async function drawMaskedPatternLayer(
  ctx: CanvasRenderingContext2D,
  style: PatternRenderStyle,
  maskImageUrl: string,
  width: number,
  height: number,
) {
  const maskImage = await loadImage(maskImageUrl).catch(() => undefined);
  if (!maskImage) return;

  const patternCanvas = createMaskedPatternCanvas(maskImage, style.backgroundImage, width, height);
  if (!patternCanvas) return;

  ctx.save();
  ctx.globalAlpha = getStyleOpacity(style.opacity);
  ctx.drawImage(patternCanvas, 0, 0, width, height);
  ctx.restore();
}

function createPatternCanvas(image: HTMLImageElement, width: number, height: number) {
  const patternCanvas = document.createElement('canvas');
  const patternCtx = patternCanvas.getContext('2d');
  if (!patternCtx) return undefined;

  const bitmapWidth = width * EXPORT_SCALE;
  const bitmapHeight = height * EXPORT_SCALE;
  patternCanvas.width = bitmapWidth;
  patternCanvas.height = bitmapHeight;

  if (!fillScaledPattern(patternCtx, image, bitmapWidth, bitmapHeight)) return undefined;

  return patternCanvas;
}

function createMaskedPatternCanvas(
  image: HTMLImageElement,
  backgroundImage: string,
  width: number,
  height: number,
) {
  const patternCanvas = document.createElement('canvas');
  const patternCtx = patternCanvas.getContext('2d');
  if (!patternCtx) return undefined;

  const bitmapWidth = width * EXPORT_SCALE;
  const bitmapHeight = height * EXPORT_SCALE;
  patternCanvas.width = bitmapWidth;
  patternCanvas.height = bitmapHeight;

  fillPatternGradient(patternCtx, backgroundImage, bitmapWidth, bitmapHeight);

  patternCtx.globalCompositeOperation = 'destination-in';
  if (!fillScaledPattern(patternCtx, image, bitmapWidth, bitmapHeight)) return undefined;

  return patternCanvas;
}

function fillScaledPattern(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const pattern = createScaledPattern(ctx, image, PATTERN_SIZE * EXPORT_SCALE);
  if (!pattern) return false;

  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
  return true;
}

function fillPatternGradient(ctx: CanvasRenderingContext2D, backgroundImage: string, width: number, height: number) {
  const colors = getCssColors(backgroundImage);
  const gradientColors = colors.length ? colors : DARK_PATTERN_GRADIENT_COLORS;
  const gradient = createPatternGradient(ctx, backgroundImage, width, height);
  const lastColorIndex = gradientColors.length - 1;

  gradientColors.forEach((color, index) => {
    gradient.addColorStop(lastColorIndex ? index / lastColorIndex : 0, color);
  });

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function createPatternGradient(ctx: CanvasRenderingContext2D, backgroundImage: string, width: number, height: number) {
  const angle = getCssGradientAngle(backgroundImage) ?? DARK_PATTERN_GRADIENT_ANGLE;
  const radians = angle * (Math.PI / 180);
  const directionX = Math.sin(radians);
  const directionY = -Math.cos(radians);
  const halfLength = (Math.abs(width * directionX) + Math.abs(height * directionY)) / 2;
  const centerX = width / 2;
  const centerY = height / 2;

  return ctx.createLinearGradient(
    centerX - directionX * halfLength,
    centerY - directionY * halfLength,
    centerX + directionX * halfLength,
    centerY + directionY * halfLength,
  );
}

function getCssGradientAngle(backgroundImage: string) {
  const match = backgroundImage.match(/linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg/i);
  if (!match) return undefined;

  const angle = Number(match[1]);
  return Number.isFinite(angle) ? angle : undefined;
}

function getStyleOpacity(opacity: string) {
  if (!opacity) return 1;

  const value = Number(opacity);
  return Number.isFinite(value) ? value : 1;
}

function getCanvasBackgroundColor(themeBackgroundColor: string, backgroundColor?: string) {
  if (backgroundColor && backgroundColor !== TRANSPARENT_COLOR) {
    return backgroundColor;
  }

  return themeBackgroundColor || DEFAULT_WALLPAPER_COLOR;
}

function createScaledPattern(ctx: CanvasRenderingContext2D, image: HTMLImageElement, patternSize = PATTERN_SIZE) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const patternHeight = sourceWidth && sourceHeight
    ? Math.max(1, Math.round(patternSize * (sourceHeight / sourceWidth)))
    : patternSize;
  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = patternSize;
  patternCanvas.height = patternHeight;

  const patternCtx = patternCanvas.getContext('2d')!;
  patternCtx.drawImage(image, 0, 0, patternSize, patternHeight);

  return ctx.createPattern(patternCanvas, 'repeat');
}

function drawCardLayout(ctx: CanvasRenderingContext2D, username: UsernameSnapshot | undefined) {
  drawCard(ctx);
  drawUsername(ctx, username);
}

function drawCard(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.fillStyle = WHITE_COLOR;
  addRoundRect(ctx, EXPORT_CARD_X, EXPORT_CARD_Y, EXPORT_CARD_WIDTH, EXPORT_CARD_HEIGHT, EXPORT_CARD_RADIUS);
  ctx.fill();
  ctx.restore();
}

function drawUsername(ctx: CanvasRenderingContext2D, username: UsernameSnapshot | undefined) {
  if (!username) return;

  const { text, style } = username;
  const qrInsetX = (EXPORT_CARD_WIDTH - EXPORT_QR_SIZE) / 2;
  const maxWidth = EXPORT_CARD_WIDTH - Math.floor(qrInsetX * 1.2);
  const fontSize = getFittedFontSize(ctx, text, style, maxWidth);
  const fittedText = getFittedText(ctx, text, maxWidth);
  const textWidth = Math.min(ctx.measureText(fittedText).width, maxWidth);

  ctx.save();
  ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = getUsernameFillStyle(
    ctx,
    style,
    EXPORT_WIDTH / 2 - textWidth / 2,
    EXPORT_WIDTH / 2 + textWidth / 2,
    fontSize,
  );
  ctx.fillText(fittedText, EXPORT_WIDTH / 2, EXPORT_USERNAME_Y);
  ctx.restore();
}

function getUsernameFillStyle(
  ctx: CanvasRenderingContext2D,
  style: UsernameStyleSnapshot,
  x1: number,
  x2: number,
  fontSize: number,
) {
  const colors = getCssColors(style.backgroundImage);
  const firstColor = colors[0];
  const lastColor = colors[colors.length - 1];
  if (firstColor && lastColor) {
    const gradient = ctx.createLinearGradient(
      x1,
      EXPORT_USERNAME_Y,
      x2,
      EXPORT_USERNAME_Y + fontSize,
    );
    gradient.addColorStop(0, firstColor);
    gradient.addColorStop(1, lastColor);
    return gradient;
  }

  return style.color || DEFAULT_WALLPAPER_COLOR;
}

async function drawAvatar(ctx: CanvasRenderingContext2D, avatar: AvatarSnapshot | undefined) {
  if (!avatar) return;
  const rect = new DOMRect(
    EXPORT_AVATAR_X - EXPORT_AVATAR_RADIUS,
    EXPORT_AVATAR_Y - EXPORT_AVATAR_RADIUS,
    EXPORT_AVATAR_SIZE,
    EXPORT_AVATAR_SIZE,
  );

  ctx.save();
  ctx.fillStyle = WHITE_COLOR;
  ctx.beginPath();
  ctx.arc(EXPORT_AVATAR_X, EXPORT_AVATAR_Y, EXPORT_AVATAR_RADIUS + AVATAR_RING_WIDTH, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(EXPORT_AVATAR_X, EXPORT_AVATAR_Y, EXPORT_AVATAR_RADIUS, 0, Math.PI * 2);
  ctx.clip();

  if (avatar.imageSrc) {
    const image = await loadImage(avatar.imageSrc).catch(() => undefined);
    if (image) {
      drawImageCover(ctx, image, rect.x, rect.y, rect.width, rect.height);
    } else {
      drawAvatarFallback(ctx, avatar, rect);
    }
  } else {
    drawAvatarFallback(ctx, avatar, rect);
  }

  ctx.restore();
}

function drawAvatarFallback(ctx: CanvasRenderingContext2D, avatar: AvatarSnapshot, rect: DOMRect) {
  const colors = getCssColors(avatar.backgroundImage);
  const firstColor = colors[0];
  const lastColor = colors[colors.length - 1];
  if (firstColor && lastColor) {
    const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
    gradient.addColorStop(0, firstColor);
    gradient.addColorStop(1, lastColor);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = avatar.backgroundColor || DEFAULT_WALLPAPER_COLOR;
  }
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  const text = avatar.text;
  if (!text) return;

  const fontSize = getScaledAvatarFontSize(avatar, rect.width);
  ctx.fillStyle = avatar.color || WHITE_COLOR;
  ctx.font = `${avatar.fontWeight} ${fontSize}px ${avatar.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, rect.x + rect.width / 2, rect.y + rect.height / 2);
}

async function drawQr(
  ctx: CanvasRenderingContext2D,
  url: string,
  gradient: QrGradientStops,
) {
  const qrLogoUrl = createQrLogoUrl(gradient);

  try {
    const exportQrCode = await createStyledQrCode({
      size: EXPORT_QR_SIZE * EXPORT_SCALE,
      gradient,
      image: qrLogoUrl,
    });
    exportQrCode.update({ data: url });
    const qrBlob = await exportQrCode.getRawData('png');
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

function createQrLogoUrl(gradient: QrGradientStops) {
  const logoSvgElement = jsxToHtml(
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${QR_LOGO_SIZE} ${QR_LOGO_SIZE}`}>
      <defs>
        <linearGradient
          id="qrLogoGradient"
          x1="0"
          y1="0"
          x2={QR_LOGO_SIZE}
          y2={QR_LOGO_SIZE}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" style={`stop-color: ${gradient.from}`} />
          <stop offset="1" style={`stop-color: ${gradient.to}`} />
        </linearGradient>
      </defs>
      <path fillRule="evenodd" clipRule="evenodd" fill="url(#qrLogoGradient)" d={QR_LOGO_PATH} />
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

function getScaledAvatarFontSize(avatar: AvatarSnapshot, exportSize: number) {
  const fontSize = parseFloat(avatar.fontSize || '0');
  if (!Number.isFinite(fontSize)) {
    return exportSize / AVATAR_FONT_SIZE_RATIO_FALLBACK;
  }

  if (!avatar.size) {
    return fontSize;
  }

  return fontSize * (exportSize / avatar.size);
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

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const sourceWidth = 'naturalWidth' in image ? image.naturalWidth : image.width;
  const sourceHeight = 'naturalHeight' in image ? image.naturalHeight : image.height;
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (sourceRatio > targetRatio) {
    cropWidth = sourceHeight * targetRatio;
    sourceX = (sourceWidth - cropWidth) / 2;
  } else if (sourceRatio < targetRatio) {
    cropHeight = sourceWidth / targetRatio;
    sourceY = (sourceHeight - cropHeight) / 2;
  }

  ctx.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, x, y, width, height);
}

function applyCssTransform(
  ctx: CanvasRenderingContext2D,
  transform: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (!transform || transform === 'none') return;

  const matrix = parseCssTransformMatrix(transform);
  if (!matrix) return;

  ctx.translate(x + width / 2, y + height / 2);
  ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
  ctx.translate(-(x + width / 2), -(y + height / 2));
}

function parseCssTransformMatrix(transform: string) {
  const matrixMatch = transform.match(/^matrix\(([^)]+)\)$/);
  if (matrixMatch) {
    const values = matrixMatch[1].split(',').map((value) => Number(value.trim()));
    if (values.length === 6 && values.every(Number.isFinite)) {
      const [a, b, c, d, e, f] = values;
      return {
        a, b, c, d, e, f,
      };
    }
  }

  return undefined;
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

function getCssUrl(value: string) {
  const match = value.match(/url\(["']?([^"')]+)["']?\)/);
  return match?.[1];
}

function getCssColors(value: string) {
  return value.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/g) || [];
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

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | undefined>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => resolve(blob || undefined), QR_CODE_CARD_MIME_TYPE);
    } catch (err) {
      reject(err);
    }
  });
}

function formatQrRenderError(error: unknown) {
  return error instanceof Error ? {
    name: error.name,
    message: error.message,
    stack: error.stack,
  } : error;
}
