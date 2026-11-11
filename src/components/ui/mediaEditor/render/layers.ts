import type {
  EditorLayer, TextLayerAlign, TextLayerContent, TextLayerFont,
} from '../../../../types/mediaEditor';
import type { Context2D, Size } from './transform';

import { clamp } from '../../../../util/math';
import { hexToRgb } from './adjustments/values';

export type LayerFrames = Record<string, {
  frames: ImageBitmap[];
  frameRate: number;
  frameWidth?: number;
}>;

type TextLayoutLine = {
  text: string;
  x: number;
  width: number;
};

export type TextLayout = {
  width: number;
  height: number;
  fontSize: number;
  lines: TextLayoutLine[];
  backgroundPath?: string;
};

type DrawLayersOptions = {
  frames: LayerFrames;
  time?: number;
};

type TextFont = {
  family: string;
  weight: number;
};

type LineRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type Point = {
  x: number;
  y: number;
};

type MeasureText = (text: string) => number;

export const TEXT_FONTS: Record<TextLayerFont, TextFont> = {
  roboto: { family: 'Roboto, sans-serif', weight: 500 },
  suez: { family: '"Suez One", serif', weight: 400 },
  fugaz: { family: '"Fugaz One", sans-serif', weight: 400 },
  courier: { family: '"Courier Prime", monospace', weight: 700 },
  chewy: { family: 'Chewy, cursive', weight: 400 },
  sedan: { family: 'Sedan, serif', weight: 400 },
  bubbles: { family: '"Rubik Bubbles", sans-serif', weight: 400 },
  playwrite: { family: '"Playwrite BE VLG", cursive', weight: 400 },
};

const STICKER_SIZE = 0.3;
const TEXT_MIN_WIDTH = 0.16;
const TEXT_MAX_WIDTH = 0.9;
const LINE_HEIGHT = 1.2;
const PADDING_X = 0.4;
const PADDING_Y = 0.2;
const TEXT_BLEED = 0.5;
const BOX_RADIUS = 0.3;
const BACKGROUND_MERGE_RATIO = 1.5;
const MEASURE_FONT_SIZE = 100;
const PATH_PRECISION = 100;
const SHADOW_BLUR = 0.1;
const SHADOW_COLOR = 'rgba(0, 0, 0, 0.4)';
const SEMI_BACKGROUND = 'rgba(0, 0, 0, 0.5)';
const CONTRAST_LUMA_THRESHOLD = 0.6;
const GRAPHEME_SEGMENTER = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : undefined;

let measureContext: Context2D | undefined;

export function drawLayers(
  ctx: Context2D, layers: EditorLayer[], frameSize: Size, { frames, time = 0 }: DrawLayersOptions,
) {
  layers.forEach((layer) => {
    const frame = getLayerFrame(layer, frames, time);
    if (layer.type === 'sticker' && !frame) return;

    ctx.save();
    ctx.translate(layer.x * frameSize.width, layer.y * frameSize.height);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    if (frame) {
      const { width, height } = measureLayerImage(layer, frame.image, frameSize, frame.frameWidth);
      ctx.drawImage(frame.image, -width / 2, -height / 2, width, height);
    } else {
      const layout = layoutText(layer, frameSize);
      ctx.translate(-layout.width / 2, -layout.height / 2);
      drawTextBox(ctx, layer.text!, layout);
    }
    ctx.restore();
  });
}

export function closeLayerFrames(layerFrames?: LayerFrames) {
  Object.values(layerFrames ?? {}).forEach(({ frames }) => frames.forEach((frame) => frame.close()));
}

export function measureLayer(layer: EditorLayer, frameSize: Size): Size {
  if (layer.type === 'sticker') {
    const side = Math.min(frameSize.width, frameSize.height) * STICKER_SIZE * layer.scale;
    return { width: side, height: side };
  }

  const { width, height } = layoutText(layer, frameSize);
  return { width, height };
}

export function getIsLayerVisible(layer: EditorLayer, frameSize: Size) {
  const { width, height } = measureLayer(layer, frameSize);
  const radius = Math.hypot(width, height) / 2;
  const x = layer.x * frameSize.width;
  const y = layer.y * frameSize.height;
  return x + radius > 0 && y + radius > 0 && x - radius < frameSize.width && y - radius < frameSize.height;
}

export function layoutText(layer: EditorLayer, frameSize: Size, value = layer.text!.value): TextLayout {
  const text = layer.text!;
  const fontSize = getFontSize(layer, frameSize);
  const paddingX = fontSize * PADDING_X;
  const measureScale = fontSize / MEASURE_FONT_SIZE;
  const { minWidth, maxWidth } = getTextWidthLimits(layer, frameSize);
  const measure = createTextMeasurer(text);
  const maxLineWidth = (TEXT_MAX_WIDTH / text.size - PADDING_X * 2) * MEASURE_FONT_SIZE;

  const paragraphs = value.split('\n').map((paragraph) => paragraph.trimEnd());
  const paragraphWidths = paragraphs.map(measure);
  const measuredLines = paragraphs.flatMap((paragraph, i) => (
    paragraphWidths[i] > maxLineWidth
      ? wrapParagraph(paragraph, maxLineWidth, measure).map((line) => ({ text: line, width: measure(line) }))
      : [{ text: paragraph, width: paragraphWidths[i] }]
  ));
  const naturalWidth = Math.max(...paragraphWidths) * measureScale;
  const width = Math.ceil(clamp(naturalWidth + paddingX * 2, minWidth, maxWidth));
  const height = Math.ceil(measuredLines.length * fontSize * LINE_HEIGHT + fontSize * PADDING_Y * 2);
  const lines = measuredLines.map((line) => {
    const lineWidth = line.width * measureScale;
    return { text: line.text, width: lineWidth, x: getLineX(text.align, width, lineWidth, paddingX) };
  });

  return {
    width,
    height,
    fontSize,
    lines,
    backgroundPath: text.style !== 'plain' ? buildBackgroundPath(lines, fontSize) : undefined,
  };
}

export function getTextWidthLimits(layer: EditorLayer, frameSize: Size) {
  const scaledWidth = frameSize.width * layer.scale;
  return { minWidth: scaledWidth * TEXT_MIN_WIDTH, maxWidth: scaledWidth * TEXT_MAX_WIDTH };
}

export function getTextFill({ style, color }: TextLayerContent) {
  return {
    color: style === 'filled' ? getTextContrastColor(color) : color,
    background: style === 'filled' ? color : SEMI_BACKGROUND,
  };
}

export function renderTextLayerImage(layer: EditorLayer, frameSize: Size) {
  const layout = layoutText(layer, frameSize);
  const bleed = Math.ceil(layout.fontSize * TEXT_BLEED);
  const canvas = new OffscreenCanvas(Math.max(1, layout.width), Math.max(1, layout.height + bleed * 2));
  const ctx = canvas.getContext('2d')!;
  ctx.translate(0, bleed);
  drawTextBox(ctx, layer.text!, layout);
  return canvas.transferToImageBitmap();
}

export function loadTextLayerFonts(layers: EditorLayer[]) {
  const pendingTexts = layers.flatMap(({ text }) => (
    text && !document.fonts.check(buildFont(text, 1), text.value) ? [text] : []
  ));
  if (!pendingTexts.length) return undefined;

  return Promise.all(pendingTexts.map((text) => (
    document.fonts.load(buildFont(text, 1), text.value).catch(() => undefined)
  )));
}

function getTextContrastColor(color: string) {
  const [r, g, b] = hexToRgb(color);
  return 0.299 * r + 0.587 * g + 0.114 * b > CONTRAST_LUMA_THRESHOLD ? '#000000' : '#FFFFFF';
}

function getLayerFrame(layer: EditorLayer, frames: LayerFrames, time: number) {
  const entry = frames[layer.type === 'sticker' ? layer.sticker!.id : layer.id];
  if (!entry?.frames.length) return undefined;

  const index = Math.floor(time * entry.frameRate) % entry.frames.length;
  return { image: entry.frames[index], frameWidth: entry.frameWidth };
}

function measureLayerImage(layer: EditorLayer, image: ImageBitmap, frameSize: Size, frameWidth = frameSize.width) {
  if (layer.type === 'sticker') {
    const { width: side } = measureLayer(layer, frameSize);
    const ratio = image.width / image.height;
    return ratio > 1 ? { width: side, height: side / ratio } : { width: side * ratio, height: side };
  }

  const scale = frameSize.width / frameWidth;
  return { width: image.width * scale, height: image.height * scale };
}

function getFontSize(layer: EditorLayer, frameSize: Size) {
  return layer.text!.size * frameSize.width * layer.scale;
}

function buildFont(text: TextLayerContent, fontSize: number) {
  const { family, weight } = TEXT_FONTS[text.font];
  return `${weight} ${fontSize}px ${family}`;
}

function createTextMeasurer(text: TextLayerContent): MeasureText {
  measureContext ??= new OffscreenCanvas(1, 1).getContext('2d')!;
  const ctx = measureContext;
  ctx.font = buildFont(text, MEASURE_FONT_SIZE);
  return (line) => ctx.measureText(line).width;
}

function wrapParagraph(paragraph: string, maxWidth: number, measure: MeasureText) {
  const lines: string[] = [];
  let line = '';
  const words = paragraph.match(/ *[^ ]+ */g)?.flatMap((word) => word.split(/(?<=[\p{L}\p{M}]-)(?=\p{L})/u));
  words?.forEach((word) => {
    if (measure((line + word).trimEnd()) <= maxWidth) {
      line += word;
      return;
    }

    if (line) lines.push(line.trimEnd());
    let chars = splitGraphemes(word);
    while (chars.length > 1 && measure(chars.join('').trimEnd()) > maxWidth) {
      const count = countFittingChars(chars, maxWidth, measure);
      lines.push(chars.slice(0, count).join(''));
      chars = chars.slice(count);
    }
    line = chars.join('');
  });
  lines.push(line.trimEnd());

  return lines;
}

function splitGraphemes(text: string) {
  return GRAPHEME_SEGMENTER
    ? Array.from(GRAPHEME_SEGMENTER.segment(text), ({ segment }) => segment)
    : Array.from(text);
}

function countFittingChars(chars: string[], maxWidth: number, measure: MeasureText) {
  let low = 1;
  let high = chars.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (measure(chars.slice(0, middle).join('')) <= maxWidth) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low;
}

function getLineX(align: TextLayerAlign, boxWidth: number, lineWidth: number, paddingX: number) {
  if (align === 'left') return paddingX;
  if (align === 'right') return boxWidth - paddingX - lineWidth;
  return (boxWidth - lineWidth) / 2;
}

function buildBackgroundPath(lines: TextLayoutLine[], fontSize: number) {
  const paddingX = fontSize * PADDING_X;
  const paddingY = fontSize * PADDING_Y;
  const lineHeight = fontSize * LINE_HEIGHT;
  const groups: LineRect[][] = [[]];
  lines.forEach(({ text, x, width }, i) => {
    if (!text) {
      groups.push([]);
      return;
    }

    groups[groups.length - 1].push({
      left: x - paddingX,
      right: x + width + paddingX,
      top: paddingY + lineHeight * i,
      bottom: paddingY + lineHeight * (i + 1),
    });
  });

  const path = groups
    .filter((rects) => rects.length)
    .map((rects) => buildGroupPath(rects, fontSize))
    .join(' ');
  return path || undefined;
}

function buildGroupPath(rects: LineRect[], fontSize: number) {
  const radius = fontSize * BOX_RADIUS;
  const mergeDistance = radius * BACKGROUND_MERGE_RATIO;
  const first = rects[0];
  const last = rects[rects.length - 1];
  first.top -= fontSize * PADDING_Y;
  last.bottom += fontSize * PADDING_Y;

  for (let i = 1; i < rects.length; i++) {
    for (let j = i; j > 0; j--) {
      const upper = rects[j - 1];
      const lower = rects[j];
      if (Math.abs(upper.left - lower.left) < mergeDistance) {
        upper.left = Math.min(upper.left, lower.left);
        lower.left = upper.left;
      }
      if (Math.abs(upper.right - lower.right) < mergeDistance) {
        upper.right = Math.max(upper.right, lower.right);
        lower.right = upper.right;
      }
    }
  }

  const points: Point[] = [{ x: first.left, y: first.top }, { x: first.right, y: first.top }];
  for (let i = 1; i < rects.length; i++) {
    if (rects[i].right !== rects[i - 1].right) {
      points.push({ x: rects[i - 1].right, y: rects[i].top }, { x: rects[i].right, y: rects[i].top });
    }
  }
  points.push({ x: last.right, y: last.bottom }, { x: last.left, y: last.bottom });
  for (let i = rects.length - 2; i >= 0; i--) {
    if (rects[i].left !== rects[i + 1].left) {
      points.push({ x: rects[i + 1].left, y: rects[i + 1].top }, { x: rects[i].left, y: rects[i + 1].top });
    }
  }

  return roundPolygon(points, radius);
}

function roundPolygon(points: Point[], radius: number) {
  const commands = points.map((point, i) => {
    const prev = points[(i + points.length - 1) % points.length];
    const next = points[(i + 1) % points.length];
    const incoming = Math.hypot(point.x - prev.x, point.y - prev.y);
    const outgoing = Math.hypot(next.x - point.x, next.y - point.y);
    const cornerRadius = Math.min(radius, incoming / 2, outgoing / 2);
    const start = {
      x: point.x - ((point.x - prev.x) / incoming) * cornerRadius,
      y: point.y - ((point.y - prev.y) / incoming) * cornerRadius,
    };
    const end = {
      x: point.x + ((next.x - point.x) / outgoing) * cornerRadius,
      y: point.y + ((next.y - point.y) / outgoing) * cornerRadius,
    };

    return `${i ? 'L' : 'M'}${formatPoint(start)} Q${formatPoint(point)} ${formatPoint(end)}`;
  });

  return `${commands.join(' ')} Z`;
}

function formatPoint({ x, y }: Point) {
  return `${Math.round(x * PATH_PRECISION) / PATH_PRECISION} ${Math.round(y * PATH_PRECISION) / PATH_PRECISION}`;
}

function drawTextBox(ctx: Context2D, text: TextLayerContent, { fontSize, lines, backgroundPath }: TextLayout) {
  const { color, background } = getTextFill(text);
  if (backgroundPath) {
    ctx.fillStyle = background;
    ctx.fill(new Path2D(backgroundPath));
  }

  ctx.font = buildFont(text, fontSize);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  if (text.style === 'plain') {
    ctx.shadowColor = SHADOW_COLOR;
    ctx.shadowBlur = fontSize * SHADOW_BLUR;
  }

  const lineHeight = fontSize * LINE_HEIGHT;
  const { fontBoundingBoxAscent: ascent, fontBoundingBoxDescent: descent } = ctx.measureText(text.value);
  const firstBaseline = fontSize * PADDING_Y + (lineHeight + ascent - descent) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line.text, line.x, firstBaseline + lineHeight * i);
  });
}
