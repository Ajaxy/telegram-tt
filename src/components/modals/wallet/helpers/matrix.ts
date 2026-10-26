import { clamp } from '../../../../util/math';

type Rgba = [number, number, number, number];

type Piece = {
  char: string;
  x: number;
  slot: number;
  font: string;
  size: number;
  color: Rgba;
  baseline: number;
  drop: number;
  // An emoji is an image in the markup, so it lands as a picture instead of a letter
  image?: { element: HTMLImageElement; y: number; height: number };
};

type Samples = { fills: string[]; width: number };

type Stream = { start: number; fall: number };

type AvatarCell = {
  shownAt: number;
  settledAt: number;
  decodeAt: number;
};

type AvatarLayout = {
  x: number;
  y: number;
  size: number;
  source: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  baselines: number[];
  // The streams fall from above the first row to the baseline of the last one
  top: number;
  bottom: number;
  streams: Stream[];
  cells: AvatarCell[];
  decodedAt: number;
  samples: Map<number, Samples | undefined>;
};

type AddressColumn = Stream & { filledRows: number[] };

type AddressLayout = {
  font: string;
  size: number;
  advance: number;
  ascent: number;
  x: number;
  y: number;
  lineHeight: number;
  lines: string[];
  columns: AddressColumn[];
  groupColors: (Rgba | undefined)[][];
  highlightStarts: number[][];
};

type Layout = {
  width: number;
  height: number;
  pixelRatio: number;
  headInk: Rgba;
  gray: Rgba;
  avatar?: AvatarLayout;
  address: AddressLayout;
  pieces: Piece[];
};

export const MATRIX_DURATION = 2.1;
const HEX_BYTE_REGEX = /[\da-f]{2}/gi;
const MAX_PIXEL_RATIO = 3;
const AVATAR_ROW_HEIGHT = 10.5;
const CAP_HEIGHT_RATIO = 0.7;
const AVATAR_FALL = 0.3;
const TITLE_FALL = 0.3;
const FALL_JITTER = 0.08;
const ADDRESS_DELAY = 0.08;
const ADDRESS_FALL = 0.36;
const ADDRESS_FALL_JITTER = 0.1;
const SETTLE_DELAY = 0.14;
const DECODE_DELAY = 0.1;
const DECODE_JITTER = 0.04;
const DECODE_DURATION = 0.24;
const STREAM_LEAD_ROWS = 1.6;
const FINAL_GLYPH_PROGRESS = 0.72;
const FALLING_ALPHA = 0.55;
const TITLE_DROP = 1.1;
const TITLE_FADE_IN = 0.4;
const HIGHLIGHT_DELAY = 0.06;
const HIGHLIGHT_DURATION = 0.24;
const SMEAR_PER_SPEED = 0.04;
const SMEAR_MAX_SIZES = 1.2;
const SMEAR_SAMPLE_STEP = 1.2;
const SMEAR_MAX_SAMPLES = 14;
const SMEAR_WEIGHT_POWER = 1.6;
const SMEAR_HEAD_ALPHA = 0.8;
const SMEAR_TAIL_ALPHA = 1.4;
const HEAD_INK_ALPHA = 0.95;
const COARSE_SPLIT = 2;
const FINE_SPLIT = 4;
// The avatar gradient runs from white at -300%, so its top is three quarters of the way to the peer color
const INITIALS_TOP_MIX = 0.75;
const WHITE: Rgba = [255, 255, 255, 1];
// Letters of these scripts join or run right to left, so such a name falls whole rather than letter by letter
const WHOLE_NAME_SCRIPT_REGEX = /[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u;
const GRAPHEME_SEGMENTER = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
  : undefined;
const MIN_AVATAR_COLUMNS = 3;
const MIN_AVATAR_ROWS = 2;
const MIN_SMEAR_ALPHA = 0.01;
const MIN_SMEAR_SAMPLES = 2;
const MIN_SMEAR_WEIGHT = 0.001;
const DECODE_NOISE_ROW_STRIDE = 7;
// The photo decodes in three equal stages: a glyph fades over coarse pixels, then fine pixels, then the photo itself
const DECODE_STAGE = 1 / 3;
// Each cell is clipped a little wider, and each sample pixel drawn a little larger, so no seams show between them
const CELL_BLEED = 0.5;
const PIXEL_SEAM = 0.3;
const RGBA_CHANNELS = 4;
const SALT = {
  avatarStart: 31,
  avatarFall: 32,
  title: 51,
  titleFall: 52,
  titleGlyph: 53,
  decode: 71,
  still: 77,
  flicker: 78,
  avatarHead: 79,
  addressStart: 1,
  addressFall: 2,
  addressHead: 7,
  addressRow: 11,
};
// Trail weights of a smear by its sample count, normalized over the samples behind the head
const SMEAR_WEIGHTS = Array.from({ length: SMEAR_MAX_SAMPLES + 1 }, (_, count) => {
  const weights = Array.from({ length: count }, (__, i) => (
    (1 - (count > 1 ? i / (count - 1) : 0)) ** SMEAR_WEIGHT_POWER
  ));
  const total = Math.max(weights.slice(1).reduce((sum, weight) => sum + weight, 0), MIN_SMEAR_WEIGHT);

  return weights.map((weight) => weight / total);
});
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const GLYPH_PERIOD = 0.045;
const MAX_GLYPH_TIME = 3600;
const WAVE_DELAY = 0.1;
const WAVE_DURATION = 0.5;
const WAVE_WIDTH = 300;
const WAVE_JITTER = 0.14;
const WAVE_JITTER_STEP = 10;
const FALL_OVERSHOOT = 0.9;
const PASS_TIME_STEPS = 18;
const NOISE_RANGE = 10000;
// Integer hashes, so the same cell flickers through the same glyphs on every play
const NOISE_PRIME = 73856093;
const NOISE_SALT_PRIME = 19349663;
const NOISE_MIX = 0x5bd1e995;
const NOISE_FIRST_SHIFT = 13;
const NOISE_SECOND_SHIFT = 15;
const GLYPH_PRIME = 2654435761 | 0;
const GLYPH_TICK_PRIME = 40503;
const GLYPH_SALT_PRIME = 97;
const POSITIVE_INT_MASK = 0x7fffffff;

export function measureLayout(
  chip: HTMLDivElement, avatarElement: HTMLDivElement | undefined, context: CanvasRenderingContext2D,
): Layout | undefined {
  const addressElement = chip.querySelector<HTMLElement>('[data-matrix="address"]');
  if (!addressElement || !chip.offsetWidth) return undefined;

  const chipRect = chip.getBoundingClientRect();
  // The chip may be scaled by an opening animation, while the canvas is laid out at its own size
  const scale = chipRect.width / chip.offsetWidth;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  const address = measureAddress(addressElement, chipRect, scale, context);
  const pieces = Array.from(chip.querySelectorAll<HTMLElement>('[data-matrix="name"], [data-matrix="username"]'))
    .flatMap((element) => measurePieces(element, chipRect, scale, context));
  const ink = parseColor(context, getComputedStyle(chip).color);

  return {
    width: chip.offsetWidth,
    height: chip.offsetHeight,
    pixelRatio,
    headInk: [ink[0], ink[1], ink[2], ink[3] * HEAD_INK_ALPHA],
    gray: parseColor(context, getComputedStyle(addressElement).color),
    avatar: avatarElement ? measureAvatar(avatarElement, chipRect, scale, pixelRatio, address, context) : undefined,
    address,
    pieces,
  };
}

function measureBox(element: Element, chipRect: DOMRect, scale: number) {
  const rect = element.getBoundingClientRect();

  return {
    x: (rect.left - chipRect.left) / scale,
    y: (rect.top - chipRect.top) / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  };
}

function measureTextBox(element: HTMLElement, chipRect: DOMRect, scale: number, context: CanvasRenderingContext2D) {
  const style = getComputedStyle(element);
  const box = measureBox(element, chipRect, scale);
  const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  context.font = font;
  const { fontBoundingBoxAscent: ascent, fontBoundingBoxDescent: descent } = context.measureText('Hg');
  const lineHeight = parseFloat(style.lineHeight) || box.height;

  return {
    style, box, font, ascent, lineHeight, top: box.y + (lineHeight - ascent - descent) / 2,
  };
}

function measureAddress(
  element: HTMLElement, chipRect: DOMRect, scale: number, context: CanvasRenderingContext2D,
): AddressLayout {
  const {
    style, box, font, ascent, lineHeight, top,
  } = measureTextBox(element, chipRect, scale, context);
  const advance = context.measureText('0').width;
  const lines = (element.textContent ?? '').split('\n');

  const colors: Rgba[][] = [[]];
  Array.from(element.children).forEach((child) => {
    colors[colors.length - 1].push(parseColor(context, getComputedStyle(child).color));
    if (child.textContent?.endsWith('\n')) colors.push([]);
  });

  const columns = Array.from({ length: Math.max(...lines.map((line) => line.length)) }, (_, column) => ({
    start: getWaveStart(box.x + advance * column, SALT.addressStart, ADDRESS_DELAY),
    fall: ADDRESS_FALL + ADDRESS_FALL_JITTER * getNoise(column, SALT.addressFall),
    filledRows: lines.flatMap((line, row) => (getAddressChar(lines, row, column) ? [row] : [])),
  }));

  return {
    font,
    size: parseFloat(style.fontSize),
    advance,
    ascent,
    x: box.x,
    y: top,
    lineHeight,
    lines,
    columns,
    groupColors: lines.map((line, row) => Array.from(line, (_, column) => (
      colors[row]?.[line.slice(0, column).split(' ').length - 1]
    ))),
    highlightStarts: lines.map((line, row) => Array.from(line, (_, column) => (
      getHighlightStart(columns, line, row, column)
    ))),
  };
}

function measurePieces(
  element: HTMLElement, chipRect: DOMRect, scale: number, context: CanvasRenderingContext2D,
): Piece[] {
  const {
    style, box, font, ascent, lineHeight, top,
  } = measureTextBox(element, chipRect, scale, context);
  const spacing = parseFloat(style.letterSpacing) || 0;
  const shared = {
    font,
    size: parseFloat(style.fontSize),
    color: parseColor(context, style.color),
    baseline: top + ascent,
    drop: lineHeight * TITLE_DROP,
  };
  // An ellipsis cuts a long name, and the letters past it do not fall
  const end = box.x + box.width;

  return Array.from(element.childNodes).flatMap((node): Piece[] => {
    if (node instanceof HTMLImageElement) {
      const imageBox = measureBox(node, chipRect, scale);
      if (imageBox.x > end) return [];

      return [{
        ...shared,
        char: '',
        x: imageBox.x,
        slot: imageBox.width,
        image: { element: node, y: imageBox.y, height: imageBox.height },
      }];
    }

    const text = node.textContent ?? '';
    const graphemes = GRAPHEME_SEGMENTER
      ? Array.from(GRAPHEME_SEGMENTER.segment(text), ({ segment }) => segment)
      : Array.from(text);
    const chars = WHOLE_NAME_SCRIPT_REGEX.test(text) ? [text] : graphemes;
    // Text after an emoji image starts past the image and its margin, which the text metrics do not know
    const range = document.createRange();
    range.selectNodeContents(node);
    const start = (range.getBoundingClientRect().left - chipRect.left) / scale;

    let prefix = '';
    return chars.flatMap((char, i) => {
      const x = start + context.measureText(prefix).width + spacing * i;
      prefix += char;
      if (char === ' ' || x > end) return [];

      return [{
        ...shared, char, x, slot: Math.min(context.measureText(char).width, box.width),
      }];
    });
  });
}

function measureAvatar(
  element: HTMLElement, chipRect: DOMRect, scale: number, pixelRatio: number, address: AddressLayout,
  context: CanvasRenderingContext2D,
): AvatarLayout {
  const box = measureBox(element, chipRect, scale);
  const size = box.width;
  const image = element.querySelector<HTMLImageElement>('img.avatar-media');
  const isImageReady = Boolean(image?.complete && image.naturalWidth);
  const source = isImageReady ? image! : paintInitials(element, size, pixelRatio, context);
  const [sourceWidth, sourceHeight] = source instanceof HTMLImageElement
    ? [source.naturalWidth, source.naturalHeight]
    : [source.width, source.height];
  const columns = Math.max(MIN_AVATAR_COLUMNS, Math.floor(size / address.advance));
  const rows = Math.max(MIN_AVATAR_ROWS, Math.floor(size / AVATAR_ROW_HEIGHT));
  const cellWidth = size / columns;
  const cellHeight = size / rows;
  const baselines = Array.from({ length: rows }, (_, row) => (
    box.y + cellHeight * row + (cellHeight + address.size * CAP_HEIGHT_RATIO) / 2
  ));
  const top = baselines[0] - cellHeight * STREAM_LEAD_ROWS;
  const bottom = baselines[rows - 1];
  const streams = Array.from({ length: columns }, (_, column) => ({
    start: getWaveStart(box.x + cellWidth * column, SALT.avatarStart),
    fall: AVATAR_FALL + FALL_JITTER * getNoise(column, SALT.avatarFall),
  }));

  const cells = Array.from({ length: rows * columns }, (_, id) => {
    const row = Math.floor(id / columns);
    const column = id % columns;
    const { start, fall } = streams[column];
    const isLast = row === rows - 1;
    const passedAt = start + findPassTime((baselines[row] - top) / (bottom - top)) * fall;
    const settledAt = isLast ? start + fall : passedAt + SETTLE_DELAY;
    const decodeJitter = DECODE_JITTER * getNoise(row * DECODE_NOISE_ROW_STRIDE + column, SALT.decode);

    return { shownAt: isLast ? settledAt : passedAt, settledAt, decodeAt: settledAt + DECODE_DELAY + decodeJitter };
  });

  return {
    x: box.x,
    y: box.y,
    size,
    source,
    sourceWidth,
    sourceHeight,
    columns,
    rows,
    cellWidth,
    cellHeight,
    baselines,
    top,
    bottom,
    streams,
    cells,
    decodedAt: Math.max(...cells.map(({ decodeAt }) => decodeAt)) + DECODE_DURATION,
    samples: new Map(),
  };
}

function paintInitials(element: HTMLElement, size: number, pixelRatio: number, context: CanvasRenderingContext2D) {
  const pixelSize = Math.round(size * pixelRatio);
  const canvas = document.createElement('canvas');
  canvas.width = pixelSize;
  canvas.height = pixelSize;
  const paint = canvas.getContext('2d')!;

  const color = parseColor(context, getComputedStyle(element).getPropertyValue('--color-user').trim());
  const gradient = paint.createLinearGradient(0, 0, 0, pixelSize);
  gradient.addColorStop(0, formatColor(mixColors(WHITE, color, INITIALS_TOP_MIX)));
  gradient.addColorStop(1, formatColor(color));
  paint.fillStyle = gradient;
  paint.fillRect(0, 0, pixelSize, pixelSize);

  const letters = element.textContent;

  if (letters) {
    const style = getComputedStyle(element);
    paint.font = `${style.fontWeight} ${(parseFloat(style.fontSize) * pixelSize) / size}px ${style.fontFamily}`;
    paint.fillStyle = style.color;
    paint.textAlign = 'center';
    paint.textBaseline = 'middle';
    paint.fillText(letters, pixelSize / 2, pixelSize / 2);
  }

  return canvas;
}

export function drawFrame(context: CanvasRenderingContext2D, layout: Layout, time: number) {
  context.clearRect(0, 0, layout.width, layout.height);
  if (layout.avatar) drawAvatar(context, layout, layout.avatar, time);
  drawTitle(context, layout, time);
  drawAddress(context, layout, time);
}

// The context aligns text to the center, so a glyph narrower than its slot sits in the middle of it
function fillGlyph(
  context: CanvasRenderingContext2D,
  char: string, font: string, x: number, slot: number, baseline: number, color: Rgba, alpha = 1,
) {
  context.font = font;
  context.globalAlpha = alpha * color[3];
  context.fillStyle = formatColor(color, 1);
  context.fillText(char, x + slot / 2, baseline, slot);
  context.globalAlpha = 1;
}

function smearGlyph(
  context: CanvasRenderingContext2D,
  char: string, font: string, size: number, x: number, slot: number, baseline: number,
  velocity: number, head: Rgba, tail: Rgba, alpha: number,
) {
  if (alpha <= MIN_SMEAR_ALPHA) return;

  const length = clamp(velocity * SMEAR_PER_SPEED, 0, size * SMEAR_MAX_SIZES);
  const count = length > 1
    ? Math.min(MIN_SMEAR_SAMPLES + Math.floor(length / SMEAR_SAMPLE_STEP), SMEAR_MAX_SAMPLES)
    : 1;
  const weights = SMEAR_WEIGHTS[count];

  for (let i = count - 1; i >= 0; i--) {
    const k = count > 1 ? i / (count - 1) : 0;
    fillGlyph(
      context, char, font, x, slot, baseline - length * k, i === 0 ? head : tail,
      alpha * (i === 0 ? SMEAR_HEAD_ALPHA : weights[i] * SMEAR_TAIL_ALPHA),
    );
  }
}

function getAvatarSamples(avatar: AvatarLayout, split: number) {
  if (avatar.samples.has(split)) return avatar.samples.get(split);

  const canvas = document.createElement('canvas');
  canvas.width = avatar.columns * split;
  canvas.height = avatar.rows * split;
  const paint = canvas.getContext('2d', { willReadFrequently: true })!;
  drawCover(paint, avatar, 0, 0, canvas.width);

  let samples: Samples | undefined;
  try {
    const { data } = paint.getImageData(0, 0, canvas.width, canvas.height);
    samples = {
      fills: Array.from({ length: data.length / RGBA_CHANNELS }, (_, i) => {
        const offset = i * RGBA_CHANNELS;

        return `rgb(${data[offset]},${data[offset + 1]},${data[offset + 2]})`;
      }),
      width: canvas.width,
    };
  } catch {
    // A photo from another origin cannot be read, and the cells skip straight to it
  }
  avatar.samples.set(split, samples);

  return samples;
}

function drawCover(context: CanvasRenderingContext2D, avatar: AvatarLayout, x: number, y: number, size: number) {
  const side = Math.min(avatar.sourceWidth, avatar.sourceHeight);
  context.drawImage(
    avatar.source,
    (avatar.sourceWidth - side) / 2, (avatar.sourceHeight - side) / 2, side, side,
    x, y, size, size,
  );
}

function clipCircle(context: CanvasRenderingContext2D, avatar: AvatarLayout) {
  context.beginPath();
  context.arc(avatar.x + avatar.size / 2, avatar.y + avatar.size / 2, avatar.size / 2, 0, Math.PI * 2);
  context.clip();
}

// The photo falls as glyphs of the address size, then each glyph decodes into the photo through coarse and fine pixels
function drawAvatar(context: CanvasRenderingContext2D, layout: Layout, avatar: AvatarLayout, time: number) {
  const { address, gray, headInk } = layout;
  const {
    columns, rows, cellWidth, cellHeight, baselines, top, bottom, cells,
  } = avatar;

  if (time >= avatar.decodedAt) {
    context.save();
    clipCircle(context, avatar);
    drawCover(context, avatar, avatar.x, avatar.y, avatar.size);
    context.restore();
    return;
  }

  avatar.streams.forEach(({ start, fall }, column) => {
    for (let row = 0; row < rows; row++) {
      const id = row * columns + column;
      const { shownAt, settledAt, decodeAt } = cells[id];
      const k = (time - decodeAt) / DECODE_DURATION;
      if (time < shownAt || k >= DECODE_STAGE) continue;

      const isStill = time >= settledAt;
      const char = isStill ? pickGlyph(id, SALT.still, 0) : pickGlyph(id, SALT.flicker, time);
      fillGlyph(
        context, char, address.font, avatar.x + cellWidth * column, cellWidth, baselines[row], gray,
        (k > 0 ? 1 - k / DECODE_STAGE : 1) * (isStill ? 1 : FALLING_ALPHA),
      );
    }

    const u = (time - start) / fall;
    if (u > 0 && u < 1) {
      const [progress, speed] = getFallPath(u);
      const y = top + (bottom - top) * progress;
      const char = u > FINAL_GLYPH_PROGRESS
        ? pickGlyph((rows - 1) * columns + column, SALT.still, 0)
        : pickGlyph(column, SALT.avatarHead, time);
      const enter = clamp((y - top) / cellHeight, 0, 1);
      smearGlyph(
        context, char, address.font, address.size, avatar.x + cellWidth * column, cellWidth, y,
        (speed * (bottom - top)) / fall, headInk, gray, enter * enter,
      );
    }
  });

  context.save();
  clipCircle(context, avatar);
  for (let column = 0; column < columns; column++) {
    for (let row = 0; row < rows; row++) {
      const k = (time - cells[row * columns + column].decodeAt) / DECODE_DURATION;
      if (k <= 0) continue;

      const x = avatar.x + cellWidth * column;
      const y = avatar.y + cellHeight * row;
      context.save();
      context.beginPath();
      context.rect(x - CELL_BLEED, y - CELL_BLEED, cellWidth + 2 * CELL_BLEED, cellHeight + 2 * CELL_BLEED);
      context.clip();

      const split = k >= DECODE_STAGE ? FINE_SPLIT : COARSE_SPLIT;
      const samples = k < 2 * DECODE_STAGE ? getAvatarSamples(avatar, split) : undefined;
      if (!samples) {
        drawCover(context, avatar, avatar.x, avatar.y, avatar.size);
      } else {
        const pixelWidth = cellWidth / split;
        const pixelHeight = cellHeight / split;
        for (let i = 0; i < split; i++) {
          for (let j = 0; j < split; j++) {
            context.fillStyle = samples.fills[(row * split + j) * samples.width + column * split + i];
            context.fillRect(
              x + pixelWidth * i, y + pixelHeight * j, pixelWidth + PIXEL_SEAM, pixelHeight + PIXEL_SEAM,
            );
          }
        }

        if (split === COARSE_SPLIT) {
          fillGlyph(
            context, pickGlyph(row * columns + column, SALT.still, 0), address.font, x, cellWidth,
            baselines[row], WHITE, 1 - k / DECODE_STAGE,
          );
        }
      }
      context.restore();
    }
  }
  context.restore();
}

function drawTitle(context: CanvasRenderingContext2D, layout: Layout, time: number) {
  layout.pieces.forEach((piece, index) => {
    const local = time - getWaveStart(piece.x, SALT.title + index);
    if (local <= 0) return;

    const fall = TITLE_FALL + FALL_JITTER * getNoise(index, SALT.titleFall);
    const u = Math.min(local / fall, 1);
    if (u >= 1) {
      if (!piece.image) {
        fillGlyph(context, piece.char, piece.font, piece.x, piece.slot, piece.baseline, piece.color);
      } else if (piece.image.element.naturalWidth) {
        context.drawImage(piece.image.element, piece.x, piece.image.y, piece.slot, piece.image.height);
      }
      return;
    }

    const [progress, speed] = getFallPath(u);
    const char = u > FINAL_GLYPH_PROGRESS && !piece.image ? piece.char : pickGlyph(index, SALT.titleGlyph, time);
    smearGlyph(
      context, char, piece.font, piece.size, piece.x, piece.slot, piece.baseline - piece.drop * (1 - progress),
      (speed * piece.drop) / fall, piece.color, layout.gray, Math.min(u / TITLE_FADE_IN, 1),
    );
  });
}

function getAddressChar(lines: string[], row: number, column: number) {
  const char = lines[row]?.[column];

  return char && char !== ' ' ? char : undefined;
}

// A group lights up once all its letters have settled
function getHighlightStart(columns: AddressColumn[], line: string, row: number, column: number) {
  let from = column;
  let to = column;
  while (from > 0 && line[from - 1] !== ' ') from--;
  while (to < line.length - 1 && line[to + 1] !== ' ') to++;

  const { filledRows } = columns[column];
  const settleDelay = row === filledRows[filledRows.length - 1] ? 0 : SETTLE_DELAY;
  let readyAt = 0;
  for (let c = from; c <= to; c++) {
    readyAt = Math.max(readyAt, columns[c].start + columns[c].fall + settleDelay);
  }

  return readyAt + HIGHLIGHT_DELAY;
}

function drawAddress(context: CanvasRenderingContext2D, layout: Layout, time: number) {
  const { address, gray, headInk } = layout;
  const { advance, lineHeight } = address;
  const getBaseline = (row: number) => address.y + address.ascent + lineHeight * row;

  address.columns.forEach(({ start, fall, filledRows }, column) => {
    const local = time - start;
    if (!filledRows.length || local <= 0) return;

    const lastRow = filledRows[filledRows.length - 1];
    const x = address.x + advance * column;
    const u = Math.min(local / fall, 1);
    const top = getBaseline(0) - lineHeight;
    const bottom = getBaseline(lastRow);
    const [progress, speed] = getFallPath(u);
    const head = top + (bottom - top) * progress;

    const putGlyph = (row: number, isSettled: boolean) => {
      const char = isSettled
        ? getAddressChar(address.lines, row, column)!
        : pickGlyph(column, SALT.addressRow + row, time);
      const highlight = getSmoothStep((time - address.highlightStarts[row][column]) / HIGHLIGHT_DURATION);
      const color = isSettled ? mixColors(gray, address.groupColors[row][column] ?? gray, highlight) : gray;
      fillGlyph(context, char, address.font, x, advance, getBaseline(row), color, isSettled ? 1 : FALLING_ALPHA);
    };

    filledRows.forEach((row) => {
      if (row === lastRow || head < getBaseline(row)) return;

      const passTime = findPassTime((getBaseline(row) - top) / (bottom - top));
      putGlyph(row, local - passTime * fall > SETTLE_DELAY);
    });

    if (u < 1) {
      const char = u > FINAL_GLYPH_PROGRESS
        ? getAddressChar(address.lines, lastRow, column)!
        : pickGlyph(column, SALT.addressHead, time);
      const enter = clamp((head - top) / lineHeight, 0, 1);
      smearGlyph(
        context, char, address.font, address.size, x, advance, head, (speed * (bottom - top)) / fall,
        headInk, gray, enter * enter,
      );
    } else {
      putGlyph(lastRow, true);
    }
  });
}

// The canvas reads any CSS color back as `#rrggbb` or `rgba(...)`
function parseColor(context: CanvasRenderingContext2D, color: string): Rgba {
  context.fillStyle = '#000';
  context.fillStyle = color;
  const normalized = String(context.fillStyle);
  if (normalized.startsWith('#')) {
    const [r, g, b] = normalized.match(HEX_BYTE_REGEX)!.map((byte) => Number(`0x${byte}`));
    return [r, g, b, 1];
  }

  const [r, g, b, a = 1] = normalized.slice(normalized.indexOf('(') + 1, -1).split(',').map(Number);
  return [r, g, b, a];
}

function mixColors(from: Rgba, to: Rgba, k: number): Rgba {
  if (k <= 0) return from;
  if (k >= 1) return to;

  const lerp = (i: number) => from[i] + (to[i] - from[i]) * k;

  return [lerp(0), lerp(1), lerp(2), lerp(3)];
}

function formatColor(color: Rgba, alpha = color[3]) {
  return `rgba(${Math.round(color[0])},${Math.round(color[1])},${Math.round(color[2])},${alpha})`;
}

function getNoise(a: number, salt: number) {
  let x = (Math.imul(a, NOISE_PRIME) ^ Math.imul(salt, NOISE_SALT_PRIME)) >>> 0;
  x ^= x >>> NOISE_FIRST_SHIFT;
  x = Math.imul(x, NOISE_MIX) >>> 0;
  x ^= x >>> NOISE_SECOND_SHIFT;

  return (x % NOISE_RANGE) / NOISE_RANGE;
}

export function pickGlyph(a: number, salt: number, time: number) {
  const tick = Math.floor(clamp(time, 0, MAX_GLYPH_TIME) / GLYPH_PERIOD);
  const hash = (Math.imul(a, GLYPH_PRIME) ^ Math.imul(tick, GLYPH_TICK_PRIME) ^ Math.imul(salt, GLYPH_SALT_PRIME))
    & POSITIVE_INT_MASK;

  return ALPHABET[hash % ALPHABET.length];
}

// When the stream at `x` from the left edge of the chip starts to fall
function getWaveStart(x: number, salt: number, delay = 0) {
  return WAVE_DELAY + delay + WAVE_DURATION * (x / WAVE_WIDTH)
    + WAVE_JITTER * getNoise(Math.floor(x * WAVE_JITTER_STEP), salt);
}

// The fall from 0 to 1 with a slight overshoot, and its speed
export function getFallPath(u: number): [number, number] {
  const cubic = FALL_OVERSHOOT + 1;
  const x = u - 1;

  return [1 + cubic * x ** 3 + FALL_OVERSHOOT * x ** 2, 3 * cubic * x ** 2 + 2 * FALL_OVERSHOOT * x];
}

export function findPassTime(target: number) {
  let low = 0;
  let high = 1;
  for (let i = 0; i < PASS_TIME_STEPS; i++) {
    const middle = (low + high) / 2;
    if (getFallPath(middle)[0] < target) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return high;
}

function getSmoothStep(k: number) {
  const t = clamp(k, 0, 1);

  return t * t * (3 - 2 * t);
}
