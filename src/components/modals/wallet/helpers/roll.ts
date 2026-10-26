import { SVG_NAMESPACE } from '../../../../config';
import { requestMeasure, requestMutation } from '../../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../../util/buildClassName';
import { ease, EASE_EASING } from './motion';

import styles from '../WalletRoll.module.scss';

export type RollSegment = {
  text: string;
  isRightAligned?: boolean;
  hasStagger?: boolean;
  className?: string;
};

type RollColumn = {
  from?: string;
  to?: string;
};

export const SPIN_DURATION = 400;
const MIN_SPIN_DURATION = SPIN_DURATION / 2;
const LETTER_STAGGER = 50;
const FRAME_COUNT = 24;
// The glyph is brightest in place and fades out towards the edge of the window
const WINDOW_SHARE = 0.58;
const FADE_EXPONENT = 2.2;
const PACE_EXPONENT = 1.2;
// Digits of any script, as a locale can format the number with its own
const FIRST_DIGIT_REGEX = /\p{Nd}/u;
const LAST_DIGIT_REGEX = /\p{Nd}(?=\P{Nd}*$)/u;
const SMEAR_FILTER_ATTRIBUTES = {
  x: '-20%', y: '-60%', width: '140%', height: '220%',
};

const smearFilters = new Map<number, SVGFilterElement>();
let filterHost: SVGSVGElement | undefined;
let lastFilterId = 0;

// Every place rolls one step from its old glyph to the new one, towards the growth of the number. Numbers pair their
// places from the right, words from the left. The row is smeared vertically by the speed of the roll.
export function startRoll(
  container: HTMLElement,
  fromSegments: RollSegment[],
  toSegments: RollSegment[],
  options: { isUp: boolean; pitch: number; maxBlur: number; onEnd: NoneToVoidFunction },
) {
  const {
    isUp, pitch, maxBlur, onEnd,
  } = options;
  const cells = toSegments.flatMap((segment, s) => (
    pairRollColumns(fromSegments[s]?.text ?? '', segment.text, segment.isRightAligned).map((column, i) => ({
      column,
      delay: segment.hasStagger ? i * LETTER_STAGGER : 0,
      ...createRollCell(column, segment.className),
    }))
  ));
  container.replaceChildren(...cells.map(({ element }) => element));

  const animations: Animation[] = [];
  let isCancelled = false;

  requestMeasure(() => {
    if (isCancelled) return;

    const widths = cells.map(({ fromMeasure, toMeasure }) => [
      fromMeasure?.offsetWidth ?? 0, toMeasure?.offsetWidth ?? 0,
    ]);

    requestMutation(() => {
      if (isCancelled) return;

      cells.forEach(({ column, delay, element, glyphs }, i) => {
        const timing = {
          delay,
          duration: Math.max(SPIN_DURATION - delay / 2, MIN_SPIN_DURATION),
          fill: 'forwards' as const,
        };
        const [fromWidth, toWidth] = widths[i];
        animations.push(element.animate(
          [{ width: `${fromWidth}px` }, { width: `${toWidth}px` }],
          { ...timing, easing: EASE_EASING },
        ));
        buildRollGlyphFrames(column, pitch, isUp).forEach((frames, g) => {
          animations.push(glyphs[g].animate(frames, timing));
        });
      });

      const filter = getSmearFilter(maxBlur);
      filter.querySelector('animate')!.beginElement();
      container.style.filter = `url(#${filter.id})`;

      Promise.all(animations.map((animation) => animation.finished)).then(() => {
        requestMutation(() => {
          if (isCancelled) return;

          container.style.filter = '';
          onEnd();
        });
      }, () => undefined);
    });
  });

  return () => {
    isCancelled = true;
    animations.forEach((animation) => animation.cancel());
    container.style.filter = '';
  };
}

// The number rolls by its places from the right, the words around it letter by letter
export function splitNumberSegments(text: string): RollSegment[] {
  const first = text.search(FIRST_DIGIT_REGEX);
  if (first === -1) return [{ text, hasStagger: true }];

  const last = text.search(LAST_DIGIT_REGEX);

  return [
    { text: text.slice(0, first), hasStagger: true },
    { text: text.slice(first, last + 1), isRightAligned: true },
    { text: text.slice(last + 1), hasStagger: true },
  ];
}

export function createSvgFilter(attributes: Record<string, string>, content: string) {
  const filter = document.createElementNS(SVG_NAMESPACE, 'filter');
  filter.id = `wallet-filter-${++lastFilterId}`;
  Object.entries(attributes).forEach(([name, value]) => filter.setAttribute(name, value));
  filter.innerHTML = content;
  filterHost ??= createFilterHost();
  filterHost.append(filter);

  return filter;
}

export function pairRollColumns(from: string, to: string, isRightAligned?: boolean): RollColumn[] {
  const fromChars = Array.from(from);
  const toChars = Array.from(to);
  const count = Math.max(fromChars.length, toChars.length);

  return Array.from({ length: count }, (_, i) => (isRightAligned ? {
    from: fromChars[fromChars.length - count + i],
    to: toChars[toChars.length - count + i],
  } : {
    from: fromChars[i],
    to: toChars[i],
  }));
}

// Rolls start together on a currency swap, so the ones with the same blur share one filter
function getSmearFilter(maxBlur: number) {
  let filter = smearFilters.get(maxBlur);
  if (!filter) {
    filter = createSvgFilter(SMEAR_FILTER_ATTRIBUTES, '<feGaussianBlur stdDeviation="0 0">'
    + `<animate attributeName="stdDeviation" dur="${SPIN_DURATION}ms" values="${buildSmearValues(maxBlur)}"`
    + ' begin="indefinite" />'
    + '</feGaussianBlur>');
    smearFilters.set(maxBlur, filter);
  }

  return filter;
}

function createFilterHost() {
  const host = document.createElementNS(SVG_NAMESPACE, 'svg');
  host.classList.add(styles.filters);
  host.setAttribute('aria-hidden', 'true');
  document.body.append(host);

  return host;
}

function createRollCell(column: RollColumn, className?: string) {
  const element = document.createElement('span');
  element.className = buildClassName(styles.cell, className);
  if (column.from === undefined) element.style.width = '0px';

  const strut = document.createElement('span');
  strut.className = styles.strut;
  strut.textContent = column.from ?? column.to ?? ' ';
  element.append(strut);

  const fromMeasure = column.from !== undefined ? createMeasure(column.from) : undefined;
  const toMeasure = column.to !== undefined ? createMeasure(column.to) : undefined;
  element.append(...[fromMeasure, toMeasure].filter(Boolean));

  const glyphs = getColumnChars(column).map((char, i) => {
    const glyph = document.createElement('span');
    glyph.className = styles.glyph;
    glyph.textContent = char;
    if (i > 0 || column.from === undefined) glyph.style.opacity = '0';
    element.append(glyph);

    return glyph;
  });

  return {
    element, fromMeasure, toMeasure, glyphs,
  };
}

function createMeasure(text: string) {
  const measure = document.createElement('span');
  measure.className = styles.measure;
  measure.textContent = text;

  return measure;
}

// A changed place rolls one step, while a new or a gone one fades along with its width
function buildRollGlyphFrames(column: RollColumn, pitch: number, isUp: boolean): Keyframe[][] {
  const chars = getColumnChars(column);
  const steps = chars.length - 1;
  const direction = isUp ? 1 : -1;

  return chars.map((_, i) => Array.from({ length: FRAME_COUNT + 1 }, (__, frame) => {
    const progress = ease(frame / FRAME_COUNT);
    const openness = column.from === undefined ? progress : column.to === undefined ? 1 - progress : 1;
    const shift = steps ? (i - progress * steps) * pitch * direction : 0;
    const visibility = steps ? getWindowVisibility(shift, pitch) : 1;

    return {
      transform: `translate(-50%, ${shift}px)`,
      opacity: visibility * openness ** FADE_EXPONENT,
    };
  }));
}

function buildSmearValues(maxBlur: number) {
  return Array.from({ length: FRAME_COUNT + 1 }, (_, frame) => {
    const pace = frame < FRAME_COUNT ? (1 - frame / FRAME_COUNT) ** PACE_EXPONENT : 0;

    return `0 ${(maxBlur * pace * pace).toFixed(2)}`;
  }).join(';');
}

function getColumnChars({ from, to }: RollColumn) {
  if (from === to) return [to!];

  return [from, to].filter((char): char is string => char !== undefined);
}

function getWindowVisibility(shift: number, pitch: number) {
  const distance = Math.abs(shift) / (pitch * WINDOW_SHARE);

  return distance >= 1 ? 0 : 1 - distance ** FADE_EXPONENT;
}
