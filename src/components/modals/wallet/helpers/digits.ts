import type { AmountToken } from './amount';

import { requestMutation } from '../../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../../util/buildClassName';
import { clamp } from '../../../../util/math';
import { matchAmountTokens } from './amount';
import {
  coast, ease, EASE_EASING, pulse, sampleFrames, settle, SETTLE_EASING,
} from './motion';
import { createSvgFilter, startRoll } from './roll';

import styles from '../WalletAmountDigits.module.scss';

export type DigitCell = AmountToken & {
  element: HTMLSpanElement;
  glyph: HTMLSpanElement;
  ghost?: HTMLSpanElement;
  filter?: SVGFilterElement;
};

export const INTEGER_CHARS = '0123456789,';
export const FRACTION_CHARS = '0123456789.';
const TYPING_DURATION = 220;
const LEAVING_DURATION = 156;
const MELT_DURATION = 120;
const SLIDE_FRAMES = 16;

// The digits are 3rem, see `.digits` in `WalletAmountField.module.scss`, and the caps of Roboto and of the system
// font are about 0.71 of it
const FONT_SIZE = 48;
const CAP_HEIGHT = FONT_SIZE * 0.71;
const COMMA_HOP = CAP_HEIGHT * 0.22;
const COMMA_HOP_EXPONENT = 0.7;
const COMMA_GROWTH = 0.1;
const MELT_BLUR = CAP_HEIGHT * 0.075;
const GHOST_SPREAD = 0.14;
const GHOST_SINK = 0.42;
const RISE_STRETCH = 0.12;
const RISE_SQUASH = 0.45;
const GHOST_FADE_EXPONENT = 0.7;
const RISE_FADE_EXPONENT = 0.6;
const MELT_BLUR_EXPONENT = 0.6;
// The alpha channel is stretched and cut, so the blurred glyphs merge into one drop with a sharp edge
const MELT_ALPHA_MATRIX = '0 0 0 19 -8';
const MELT_EDGE_BLUR = 0.45;
// Pixels; a smaller shift is not worth a slide
const MIN_SLIDE_SHIFT = 0.5;

const ROLL_PITCH = CAP_HEIGHT * 0.8;
const ROLL_MAX_BLUR = CAP_HEIGHT * 0.225;

const HIT_DURATION = 420;
const HIT_STAGGER = 55;
const HIT_SIZE = 0.1;
const HIT_FRAMES = sampleFrames(HIT_DURATION, (_, progress) => ({ scale: String(1 + HIT_SIZE * pulse(progress)) }));

const HIDDEN_GLYPH = { transform: 'scale(0.86)', opacity: 0, filter: 'blur(3px)' };
const SHOWN_GLYPH = { transform: 'none', opacity: 1, filter: 'none' };
const GHOST_FRAMES = buildGhostFrames();
const GLYPH_MELT_FRAMES = buildGlyphMeltFrames();
const MELT_FILTER_ATTRIBUTES = {
  x: '-40%', y: '-40%', width: '180%', height: '180%', 'color-interpolation-filters': 'sRGB',
};
const MELT_FILTER_CONTENT = '<feGaussianBlur in="SourceGraphic" stdDeviation="0">'
  + `<animate attributeName="stdDeviation" dur="${MELT_DURATION}ms" values="${buildMeltBlurValues()}"`
  + ' begin="indefinite" />'
  + '</feGaussianBlur>'
  + `<feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  ${MELT_ALPHA_MATRIX}" />`
  + `<feGaussianBlur stdDeviation="${MELT_EDGE_BLUR}" />`;

export function measureWidths(measurer: HTMLElement) {
  const chars = [...INTEGER_CHARS, ...FRACTION_CHARS];

  return new Map(Array.from(measurer.children, (child, i) => [
    getWidthKey(chars[i], i >= INTEGER_CHARS.length), child.getBoundingClientRect().width,
  ]));
}

export function startDigitsRoll(
  container: HTMLElement, fromTokens: AmountToken[], tokens: AmountToken[], isUp: boolean, onEnd: NoneToVoidFunction,
) {
  return startRoll(container, buildRollSegments(fromTokens), buildRollSegments(tokens), {
    isUp, pitch: ROLL_PITCH, maxBlur: ROLL_MAX_BLUR, onEnd,
  });
}

export function hitDigits(cells: DigitCell[]) {
  cells.forEach(({ element }, i) => {
    element.animate(HIT_FRAMES, { duration: HIT_DURATION, delay: i * HIT_STAGGER });
  });
}

function buildRollSegments(tokens: AmountToken[]) {
  return [
    { text: tokens.filter(({ isFraction }) => !isFraction).map(({ char }) => char).join(''), isRightAligned: true },
    {
      text: tokens.filter(({ isFraction }) => isFraction).map(({ char }) => char).join(''),
      className: buildClassName(styles.cell, styles.fraction),
    },
  ];
}

export function replaceCells(container: HTMLElement, cells: DigitCell[], tokens: AmountToken[]) {
  cells.forEach(({ filter }) => filter?.remove());
  const nextCells = tokens.map(createCell);
  container.replaceChildren(...nextCells.map(({ element }) => element));

  return nextCells;
}

// Cells that stay slide from their old places to the new ones, and cells that leave shrink in place. Places come from
// the measured glyph widths, as the cells have not changed size yet.
export function updateCells(
  container: HTMLElement, widths: Map<string, number>, cells: DigitCell[], tokens: AmountToken[],
) {
  const matches = matchAmountTokens(cells, tokens);
  const oldWidths = new Map(cells.map((cell) => [cell, getWidth(widths, cell.char, cell.isFraction)]));
  const oldOffsets = new Map<DigitCell, number>();
  let offset = 0;
  cells.forEach((cell) => {
    oldOffsets.set(cell, offset);
    offset += oldWidths.get(cell)!;
  });

  const newCells = new Set<DigitCell>();
  const melts: [DigitCell, string][] = [];
  const nextCells = tokens.map((token, i) => {
    const index = matches[i];
    if (index === undefined) {
      const cell = createCell(token);
      newCells.add(cell);
      return cell;
    }

    const cell = cells[index];
    if (cell.char !== token.char) melts.push([cell, cell.char]);
    cell.char = token.char;
    cell.key = token.key;
    return cell;
  });

  const keptCells = new Set(nextCells);
  const leavingCells = cells.filter((cell) => !keptCells.has(cell));
  const cellsByElement = new Map<Element, DigitCell>(
    [...nextCells, ...leavingCells].map((cell) => [cell.element, cell]),
  );
  const keptElements = new Set<Element>(nextCells.map(({ element }) => element));
  const children = Array.from(container.children);
  const childIndices = new Map(children.map((element, i) => [element, i]));
  // Cells still shrinking from an earlier change are not in `cells`, and they keep their places as well
  const leavingElements = children.filter((element) => !keptElements.has(element));
  const order: Element[] = [];
  let leavingIndex = 0;
  nextCells.forEach(({ element }) => {
    if (childIndices.has(element)) {
      while (leavingIndex < leavingElements.length
        && childIndices.get(leavingElements[leavingIndex])! < childIndices.get(element)!) {
        order.push(leavingElements[leavingIndex++]);
      }
    }
    order.push(element);
  });
  order.push(...leavingElements.slice(leavingIndex));

  container.replaceChildren(...order);

  offset = 0;
  order.forEach((element) => {
    const cell = cellsByElement.get(element);
    if (!cell) return;

    if (newCells.has(cell)) {
      popIn(cell, getWidth(widths, cell.char, cell.isFraction));
      return;
    }

    if (keptCells.has(cell)) {
      const shift = oldOffsets.get(cell)! - offset;
      if (Math.abs(shift) > MIN_SLIDE_SHIFT) slide(cell, shift);
    }
    offset += oldWidths.get(cell)!;
  });

  melts.forEach(([cell, oldChar]) => {
    melt(cell, oldChar, oldWidths.get(cell)!, getWidth(widths, cell.char, cell.isFraction));
  });
  leavingCells.forEach((cell) => popOut(cell, oldWidths.get(cell)!));

  return nextCells;
}

function createCell(token: AmountToken): DigitCell {
  const element = document.createElement('span');
  element.className = buildClassName(styles.cell, token.isFraction && styles.fraction);
  const glyph = document.createElement('span');
  glyph.className = styles.glyph;
  glyph.textContent = token.char;
  element.append(glyph);

  return { ...token, element, glyph };
}

function popIn({ element, glyph }: DigitCell, width: number) {
  const options = { duration: TYPING_DURATION, easing: SETTLE_EASING };
  element.animate([{ width: '0px' }, { width: `${width}px` }], options);
  glyph.animate([HIDDEN_GLYPH, SHOWN_GLYPH], options);
}

function popOut(cell: DigitCell, width: number) {
  const options = { duration: LEAVING_DURATION, easing: EASE_EASING, fill: 'forwards' as const };
  cell.element.animate([{ width: `${width}px` }, { width: '0px' }], options);
  cell.glyph.animate([SHOWN_GLYPH, HIDDEN_GLYPH], options).finished.then(() => {
    requestMutation(() => {
      cell.element.remove();
      cell.filter?.remove();
    });
  }, () => undefined);
}

// A comma dives under the row, where digits have no ink, and grows a little, so it reads as flying around a digit
function slide({ element, char }: DigitCell, shift: number) {
  const isComma = char === ',';
  const frames = Array.from({ length: SLIDE_FRAMES + 1 }, (_, i) => {
    const progress = coast(i / SLIDE_FRAMES);
    const arc = Math.sin(Math.PI * clamp(progress, 0, 1));

    return {
      translate: `${shift * (1 - progress)}px ${isComma ? COMMA_HOP * arc ** COMMA_HOP_EXPONENT : 0}px`,
      scale: String(isComma ? 1 + COMMA_GROWTH * arc : 1),
    };
  });

  element.animate(frames, { duration: TYPING_DURATION });
}

// The old glyph sinks into a puddle and the new one rises from it, joined by a blur and an alpha threshold
function melt(cell: DigitCell, oldChar: string, oldWidth: number, newWidth: number) {
  if (oldWidth !== newWidth) {
    cell.element.animate(
      [{ width: `${oldWidth}px` }, { width: `${newWidth}px` }],
      { duration: MELT_DURATION, easing: SETTLE_EASING },
    );
  }

  cell.ghost?.remove();
  const ghost = document.createElement('span');
  ghost.className = styles.ghost;
  ghost.textContent = oldChar;
  cell.element.append(ghost);
  cell.ghost = ghost;
  cell.glyph.textContent = cell.char;

  cell.filter ??= createSvgFilter(MELT_FILTER_ATTRIBUTES, MELT_FILTER_CONTENT);
  cell.element.style.filter = `url(#${cell.filter.id})`;
  cell.filter.querySelector('animate')!.beginElement();

  cell.glyph.animate(GLYPH_MELT_FRAMES, MELT_DURATION);
  ghost.animate(GHOST_FRAMES, { duration: MELT_DURATION, fill: 'forwards' }).finished.then(() => {
    requestMutation(() => {
      ghost.remove();
      if (cell.ghost !== ghost) return;

      cell.ghost = undefined;
      cell.element.style.filter = '';
    });
  }, () => undefined);
}

function buildGhostFrames(): Keyframe[] {
  return Array.from({ length: SLIDE_FRAMES + 1 }, (_, i) => {
    const k = i / SLIDE_FRAMES;
    const sink = ease(k);

    return {
      opacity: (1 - k) ** GHOST_FADE_EXPONENT,
      transform: `translateX(-50%) scale(${1 + GHOST_SPREAD * sink}, ${1 - GHOST_SINK * sink})`,
    };
  });
}

function buildGlyphMeltFrames() {
  return sampleFrames(MELT_DURATION, (_, progress) => {
    const rise = settle(progress);

    return {
      opacity: progress ** RISE_FADE_EXPONENT,
      transform: `scale(${1 + RISE_STRETCH * (1 - rise)}, ${1 - RISE_SQUASH * (1 - rise)})`,
    };
  });
}

function buildMeltBlurValues() {
  return Array.from({ length: SLIDE_FRAMES + 1 }, (_, i) => (
    (MELT_BLUR * Math.sin((Math.PI * i) / SLIDE_FRAMES) ** MELT_BLUR_EXPONENT).toFixed(2)
  )).join(';');
}

function getWidth(widths: Map<string, number>, char: string, isFraction?: boolean) {
  return widths.get(getWidthKey(char, isFraction)) ?? 0;
}

function getWidthKey(char: string, isFraction?: boolean) {
  return `${isFraction ? 'fraction' : 'integer'}${char}`;
}
