import { timingFunctions } from '../../../../util/animation';
import { clamp, getSmoothStep, lerp } from '../../../../util/math';
import { BOUNCE_MS, getBounceScale } from './bounce';

export type FeePillMode = 'fee' | 'temporary' | 'permanent';

export type FeePillState = {
  mode: FeePillMode;
  // Local time when the free window ends; `undefined` while the first temporary code is on its way
  timerEndsAt?: number;
  feeBefore: string;
  feeAfter: string;
  free: string;
  noTimeLimit: string;
  formatExpiresIn: (time: string) => string;
  canAnimate: boolean;
  isRtl: boolean;
};

export type FeePillFonts = {
  regular: string;
  medium: string;
};

export type FeePillColors = {
  ink: string;
  foreground: string;
};

type Rect = { l: number; t: number; w: number; h: number };

export const FREE_WINDOW_MS = 60000;

export const CANVAS_WIDTH = 360;
export const CANVAS_ABOVE = 80;
export const CANVAS_BELOW = 40;
export const PILL_HEIGHT = 24;
export const CANVAS_HEIGHT = CANVAS_ABOVE + PILL_HEIGHT + CANVAS_BELOW;

const FILL_MS = 340;
const UNFILL_MS = 380;
const BOUNCE_UP = 0.06;
const BOUNCE_DOWN = 0.02;
const PULSE_MS = 180;
const PULSE_SCALE = 0.04;
const SHATTER_WHITE_MS = 60;
const SHATTER_CONTENT_MS = 80;
const DUST_TAIL_MS = 250;
const FLIP_MS = 200;
const FLIP_SHIFT = 10;
const FLIP_ANGLE = Math.PI / 6;
const FLIP_PERSPECTIVE = 10;
const FLIP_STRIPS = 8;
const EASE_OUT_CONTROL = 0.58;
const EASE_OUT_STEPS = 6;
const REFILL_THRESHOLD = 0.01;
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const DIGIT_RUNS_REGEX = /\d+|\D+/g;
const TIME_RUNS_REGEX = /[\d:]+|[^\d:]+/g;
const LINE_SAMPLE = 'Hg';

const PAD_X = 10;
const GAP = 4;
const STAR_SIZE = 14;
const DOT_SIZE = 3;
const DOT_SPACE = 6;
const FILL_OUTSET = 1;

const FILL_COLOR = 'rgba(255, 255, 255, 0.969)';
const GLASS_TEXT_ALPHA = 0.949;
const DETAIL_SEPARATOR_ALPHA = 0.6;

const EDGE_POINTS = 7;
const EDGE_FLOW_AMPLITUDE = 5;
const EDGE_BURN_AMPLITUDE = 2.2;
const EDGE_QUIET_ZONE = 6;
const TORN_STEP = 0.75;
const TORN_AMPLITUDE = 3.6;
const SHEEN_WIDTH = 22;

const PARTICLE_CAP = 320;
const SWEEP_DUST_RATE = 260;
const TAP_BURST = 24;
const FIZZ_RATE = 110;
const TRAIL_RATE = 70;
const SHATTER_TARGET = 260;
const SHATTER_STEP = 3;
const HALO_ALPHA = 36 / 255;

const KIND_DUST = 0;
const KIND_SPARK = 1;
const KIND_CHUNK = 2;
const KIND_DROPLET = 3;
const KIND_DROPLET_SPARK = 4;

const FRAME_MS = 1000 / 60;
const MS_IN_SECOND = 1000;
const SECONDS_IN_MINUTE = 60;
const MAX_FRAME_K = 3;

// The `star` and `star-crossed` font icons, 32×32 box
const STAR_PATH =
  'm15.289 23.671-6.001 3.676a1.325 1.325 0 0 1-1.976-1.456l.929-3.657a4.6 4.6 0 0 1 2.466-'
  + '3.013l6.547-3.143a.613.613 0 0 0-.37-1.157l-7.288 1.262a5.11 5.11 0 0 1-4.153-1.118l-2.3'
  + '02-1.929a1.324 1.324 0 0 1 .748-2.337l7.034-.55c.497-.039.93-.353 1.121-.814l2.714-6.55a'
  + '1.325 1.325 0 0 1 2.448 0l2.714 6.55c.191.46.624.775 1.121.814l7.073.553a1.325 1.325 0 0'
  + ' 1 .757 2.329l-5.394 4.599c-.38.324-.545.833-.429 1.318l1.658 6.889a1.325 1.325 0 0 1-1.'
  + '98 1.44l-6.05-3.707c-.425-.26-.96-.26-1.384 0z';
const STAR_CROSSED_PATH =
  'M14.757 2.884a1.323 1.323 0 0 1 1.73-.715c.324.133.584.39.72.715l2.712 6.55c.192.462.624'
  + '.776 1.12.814l7.072.554a1.324 1.324 0 0 1 .756 2.33l-5.392 4.598a1.32 1.32 0 0 0-.43 1.3'
  + '18l.026.117 6.585 6.582a1.278 1.278 0 0 1-1.808 1.806L4.86 4.565a1.278 1.278 0 0 1 1.808'
  + '-1.806l5.755 5.757zm9.576 24.306a1.31 1.31 0 0 1-1.61.186l-6.047-3.705c-.427-.26-.96-.26'
  + '-1.385 0L9.29 27.346a1.326 1.326 0 0 1-1.977-1.456l.93-3.657a4.6 4.6 0 0 1 2.467-3.012l3'
  + '.818-1.836zm-11.56-11.56-3.178.552a5.12 5.12 0 0 1-4.15-1.117l-2.302-1.928a1.33 1.33 0 0'
  + ' 1-.166-1.87c.23-.27.557-.439.912-.467l3.755-.299z';
const ICON_BOX = 32;

type LabelRun = { text: string; x: number };

type LabelFlip = {
  char: string; oldChar: string; x: number; index: number;
};

type Label = {
  text: string;
  fromText: string;
  runs: LabelRun[];
  flips: LabelFlip[];
  width: number;
  fromWidth: number;
  startedAt: number;
};

type Particles = {
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  ay: Float32Array;
  life: Float32Array;
  age: Float32Array;
  size: Float32Array;
  alpha: Float32Array;
  sx: Float32Array;
  sy: Float32Array;
  wobbleFreq: Float32Array;
  wobblePhase: Float32Array;
  kind: Uint8Array;
  isBurn: Uint8Array;
  count: number;
};

export type FeePillEffect = {
  update: (state: FeePillState) => void;
  setColors: (colors: FeePillColors) => void;
  destroy: () => void;
};

export function createFeePillEffect({
  canvas, pillElement, fonts, colors, dpr, schedule,
}: {
  canvas: HTMLCanvasElement;
  pillElement: HTMLElement;
  fonts: FeePillFonts;
  colors: FeePillColors;
  dpr: number;
  schedule: (tick: () => boolean) => void;
}): FeePillEffect {
  const ctx = canvas.getContext('2d')!;
  const starPath = new Path2D(STAR_PATH);
  const starCrossedPath = new Path2D(STAR_CROSSED_PATH);
  const particles = createParticles();

  let state: FeePillState | undefined;
  let currentColors = colors;
  let isFree = false;
  let sweep = 0;
  let sweepFrom = 0;
  let sweepTo = 0;
  let sweepStart = 0;
  let isSweepDone = false;
  let burn = 1;
  let refillFrom = 0;
  let refillStart = 0;
  let bounceStart = 0;
  let fillEndsAt = 0;
  let isBurstPending = false;
  let shatterAt = 0;
  let isShatterPending = false;
  let shatterRect: Rect | undefined;
  let restoreFreeWidth = 0;
  let lastFrame = 0;
  let frameK = 1;
  let edgeAmplitude = 0;
  let label: Label | undefined;
  let isRunning = false;
  let isDestroyed = false;
  let lastPillWidth = 0;
  let lastPillTransform = '';
  let secondTimeout: number | undefined;

  canvas.width = Math.round(CANVAS_WIDTH * dpr);
  canvas.height = Math.round(CANVAS_HEIGHT * dpr);

  ctx.font = fonts.regular;
  const digitWidths = DIGITS.map((digit) => ctx.measureText(digit).width);
  const digitCell = Math.max(...digitWidths);
  const lineMetrics = ctx.measureText(LINE_SAMPLE);
  const lineHalf = (lineMetrics.fontBoundingBoxAscent + lineMetrics.fontBoundingBoxDescent) / 2;
  const baselineShift = (lineMetrics.fontBoundingBoxAscent - lineMetrics.fontBoundingBoxDescent) / 2;

  function update(next: FeePillState) {
    const prev = state;
    state = next;
    const now = performance.now();

    if (!prev) {
      isFree = next.mode !== 'fee';
      sweep = isFree ? 1 : 0;
      sweepFrom = sweep;
      sweepTo = sweep;
      isSweepDone = isFree;
      setLabel(getDetail(), false, now);
    } else if (prev.mode === 'fee' && next.mode !== 'fee') {
      makeFree(now);
    } else if (prev.mode !== 'fee' && next.mode === 'fee') {
      restoreFee(now);
    }

    start();
  }

  function setColors(next: FeePillColors) {
    currentColors = next;
    start();
  }

  function makeFree(now: number) {
    isFree = true;
    shatterAt = 0;
    refillStart = 0;
    startSweep(1, now);
    isSweepDone = false;
    isBurstPending = true;
    bounceStart = now;
    fillEndsAt = now + FILL_MS;
    setLabel(getDetail(), false, now);
  }

  function restoreFee(now: number) {
    restoreFreeWidth = measureFreeWidth(now);
    shatterRect = undefined;
    isFree = false;
    isShatterPending = sweep * burn > 0.001;
    shatterAt = now;
    startSweep(0, now);
  }

  function startSweep(to: number, now: number) {
    sweepFrom = sweep;
    sweepTo = to;
    sweepStart = now;
  }

  function start() {
    window.clearTimeout(secondTimeout);
    secondTimeout = undefined;
    if (isRunning || isDestroyed) return;
    isRunning = true;
    lastFrame = 0;
    schedule(tick);
  }

  function tick() {
    if (isDestroyed || !state) {
      isRunning = false;
      return false;
    }

    const now = performance.now();
    frameK = lastFrame ? Math.min(MAX_FRAME_K, (now - lastFrame) / FRAME_MS) : 1;
    lastFrame = now;

    step(now);
    draw(now);

    const shouldContinue = getIsAnimating(now);
    isRunning = shouldContinue;
    if (!shouldContinue && getIsTimerRunning()) {
      const msLeft = state.timerEndsAt! - Date.now();
      secondTimeout = window.setTimeout(start, Math.max(0, msLeft % MS_IN_SECOND) + 1);
    }
    return shouldContinue;
  }

  function getIsTimerRunning() {
    return isFree && state!.mode === 'temporary' && state!.timerEndsAt !== undefined;
  }

  function getDetail() {
    const { mode, timerEndsAt } = state!;
    if (mode === 'permanent') return state!.noTimeLimit;
    const seconds = timerEndsAt === undefined
      ? FREE_WINDOW_MS / MS_IN_SECOND
      : Math.max(1, Math.ceil((timerEndsAt - Date.now()) / MS_IN_SECOND));
    const minutes = Math.floor(seconds / SECONDS_IN_MINUTE);
    const rest = seconds % SECONDS_IN_MINUTE;
    return state!.formatExpiresIn(`${minutes}:${rest < 10 ? '0' : ''}${rest}`);
  }

  function step(now: number) {
    const { canAnimate, mode, timerEndsAt } = state!;
    if (!canAnimate) {
      sweep = sweepTo;
    } else {
      const duration = sweepTo > sweepFrom ? FILL_MS : UNFILL_MS;
      const progress = Math.min(1, (now - sweepStart) / duration);
      sweep = lerp(sweepFrom, sweepTo, timingFunctions.easeOutCubic(progress));
    }
    if (isFree && sweep >= 0.999) isSweepDone = true;
    if (isFree) {
      const burnTarget = mode === 'temporary' && timerEndsAt !== undefined
        ? clamp01((timerEndsAt - Date.now()) / FREE_WINDOW_MS)
        : 1;
      if (canAnimate && isSweepDone && !refillStart && burnTarget - burn > REFILL_THRESHOLD) {
        refillFrom = burn;
        refillStart = now;
        fillEndsAt = now + FILL_MS;
      }
      if (refillStart) {
        const progress = Math.min(1, (now - refillStart) / FILL_MS);
        burn = lerp(refillFrom, burnTarget, timingFunctions.easeOutCubic(progress));
        if (progress === 1) refillStart = 0;
      } else {
        burn = burnTarget;
      }
      const detail = getDetail();
      if (label && detail !== label.text) setLabel(detail, canAnimate, now);
    }
  }

  function getIsAnimating(now: number) {
    const { canAnimate, mode, timerEndsAt } = state!;
    if (!canAnimate) return false;

    return particles.count > 0
      || Math.abs(sweep - sweepTo) > 0.0005
      || (isFree && (!isSweepDone || refillStart > 0))
      || now - bounceStart < BOUNCE_MS
      || (shatterAt > 0 && now - shatterAt < Math.max(PULSE_MS, SHATTER_CONTENT_MS))
      || (isFree && getIsLabelAnimating(now))
      || (isFree && mode === 'temporary' && timerEndsAt !== undefined && burn > 0);
  }

  function draw(now: number) {
    const { canAnimate } = state!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (state!.isRtl) {
      ctx.translate(CANVAS_WIDTH, 0);
      ctx.scale(-1, 1);
    }
    ctx.direction = state!.isRtl ? 'rtl' : 'inherit';
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const feeWidth = measureFeeWidth();
    const freeWidth = !isFree && restoreFreeWidth > 0 && sweep > 0.001 ? restoreFreeWidth : measureFreeWidth(now);
    if (!isFree && sweep <= 0.001) restoreFreeWidth = 0;
    const widthProgress = isFree ? Math.max(sweep, isSweepDone ? 1 : 0) : sweep;
    const width = lerp(feeWidth, freeWidth, widthProgress);
    const pill: Rect = {
      l: (CANVAS_WIDTH - width) / 2, t: CANVAS_ABOVE, w: width, h: PILL_HEIGHT,
    };

    let scale = canAnimate && bounceStart ? getBounceScale((now - bounceStart) / BOUNCE_MS, BOUNCE_UP, BOUNCE_DOWN) : 1;
    if (canAnimate && shatterAt > 0 && !isFree && now - shatterAt < PULSE_MS) {
      scale *= 1 + PULSE_SCALE * Math.sin(Math.PI * (now - shatterAt) / PULSE_MS);
    }
    syncPillElement(width, scale);

    const cx = pill.l + pill.w / 2;
    const cy = pill.t + pill.h / 2;
    ctx.save();
    if (scale !== 1) {
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
    }
    drawPill(pill, now);
    ctx.restore();

    if (canAnimate) drawParticles(pill);
  }

  function drawPill(pill: Rect, now: number) {
    const { canAnimate } = state!;
    const fill: Rect = {
      l: pill.l - FILL_OUTSET, t: pill.t - FILL_OUTSET, w: pill.w + 2 * FILL_OUTSET, h: pill.h + 2 * FILL_OUTSET,
    };
    const fillRadius = fill.h / 2;
    const isShattered = shatterAt > 0 && !isFree;

    if (isShatterPending) {
      isShatterPending = false;
      shatterRect = {
        l: fill.l, t: fill.t, w: fill.w * sweep * burn, h: fill.h,
      };
      if (canAnimate) emitShatter(shatterRect, pill);
    }

    const fraction = isShattered ? 0 : sweep * burn;
    const edge = fill.l + fill.w * fraction;
    const contentProgress = isShattered && canAnimate ? clamp01((now - shatterAt) / SHATTER_CONTENT_MS) : 1;

    if (isShattered && contentProgress < 1 && shatterRect && canAnimate) {
      const whiteAlpha = 1 - clamp01((now - shatterAt) / SHATTER_WHITE_MS);
      ctx.save();
      ctx.clip(roundRectPath(fill, fillRadius));
      ctx.beginPath();
      ctx.rect(shatterRect.l, shatterRect.t, shatterRect.w, shatterRect.h);
      ctx.clip();
      if (whiteAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.969 * whiteAlpha})`;
        ctx.fillRect(shatterRect.l, shatterRect.t, shatterRect.w, shatterRect.h);
      }
      ctx.globalAlpha = 1 - contentProgress;
      drawFreeContent(pill, currentColors.ink, now);
      ctx.restore();
    }

    const isRefilling = refillStart > 0;
    const isFlowing = isFree && (!isSweepDone || isRefilling) && canAnimate;
    const isBurning = isFree && isSweepDone && !isRefilling && state!.mode === 'temporary' && fraction < 0.999;
    const edgePath = buildEdgePath(edge, pill, fill, isFlowing, now);
    let tornPath: Path2D | undefined;

    if (fraction > 0.001) {
      ctx.save();
      ctx.clip(roundRectPath(fill, fillRadius));
      ctx.clip(edgePath);
      ctx.fillStyle = FILL_COLOR;
      if (isBurning) {
        tornPath = buildTornPath(fill, edge);
        ctx.fill(tornPath);
      } else {
        ctx.fillRect(fill.l, fill.t, edge + edgeAmplitude - fill.l, fill.h);
      }
      if (isBurning || isFlowing) {
        const sheen = ctx.createLinearGradient(edge - SHEEN_WIDTH, 0, edge + 1, 0);
        sheen.addColorStop(0, 'rgba(255, 255, 255, 0)');
        sheen.addColorStop(0.88, FILL_COLOR);
        sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = sheen;
        ctx.fillRect(edge - SHEEN_WIDTH, fill.t, SHEEN_WIDTH + 1, fill.h);
      }
      ctx.restore();

      if (canAnimate) emitEdgeParticles(pill, fill, edge, isBurning, isFlowing, now);
    }

    const fillClip = isBurning ? tornPath : edgePath;
    ctx.save();
    ctx.clip(roundRectPath(pill, pill.h / 2));
    if (fraction > 0.001 && fillClip) clipOut(fillClip, pill);
    if (isFree && isSweepDone) {
      ctx.globalAlpha = GLASS_TEXT_ALPHA;
      drawFreeContent(pill, currentColors.foreground, now);
    } else {
      const feeAlpha = isShattered ? contentProgress : 1 - clamp01(1.25 * sweep);
      ctx.globalAlpha = GLASS_TEXT_ALPHA * feeAlpha;
      drawFeeContent(pill, currentColors.foreground);
    }
    ctx.restore();

    if (fraction > 0.001 && fillClip) {
      ctx.save();
      ctx.clip(fillClip);
      drawFreeContent(pill, currentColors.ink, now);
      ctx.restore();
    }

    if (isBurstPending) {
      isBurstPending = false;
      if (canAnimate) {
        for (let i = 0; i < TAP_BURST; i++) {
          emitDust(pill.l + Math.random() * pill.w * 0.4, pill.t + Math.random() * pill.h, 0.5);
        }
      }
    }
  }

  function buildEdgePath(x: number, pill: Rect, fill: Rect, isFlowing: boolean, now: number) {
    const time = (now % 100000) / 1000;
    const quiet = clamp01((x - fill.l) / EDGE_QUIET_ZONE) * clamp01((fill.l + fill.w - x) / EDGE_QUIET_ZONE);
    edgeAmplitude = (isFlowing ? EDGE_FLOW_AMPLITUDE : EDGE_BURN_AMPLITUDE) * quiet;
    const top = pill.t - 4;
    const bottom = pill.t + pill.h + 4;
    const height = bottom - top;
    const points: number[] = [];
    for (let i = 0; i < EDGE_POINTS; i++) {
      points.push(x + (Math.sin(time * 5.1 + i * 1.7) * 0.6 + Math.sin(time * 8.3 + i * 2.9) * 0.4) * edgeAmplitude);
    }

    const path = new Path2D();
    path.moveTo(pill.l - 8, top);
    path.lineTo(points[0], top);
    for (let i = 1; i < EDGE_POINTS; i++) {
      const y0 = top + height * (i - 1) / (EDGE_POINTS - 1);
      const y1 = top + height * i / (EDGE_POINTS - 1);
      path.quadraticCurveTo(points[i - 1], y0, (points[i - 1] + points[i]) / 2, (y0 + y1) / 2);
    }
    path.lineTo(points[EDGE_POINTS - 1], bottom);
    path.lineTo(pill.l - 8, bottom);
    path.closePath();
    return path;
  }

  function buildTornPath(fill: Rect, edge: number) {
    const top = fill.t - 2;
    const bottom = fill.t + fill.h + 2;
    const path = new Path2D();
    path.moveTo(fill.l - 4, top);
    for (let y = top; ; y += TORN_STEP) {
      const clampedY = Math.min(y, bottom);
      path.lineTo(edge + getTornOffset(clampedY, edge, fill.t), clampedY);
      if (clampedY >= bottom) break;
    }
    path.lineTo(fill.l - 4, bottom);
    path.closePath();
    return path;
  }

  function clipOut(path: Path2D, pill: Rect) {
    const outside = new Path2D();
    outside.rect(pill.l - 200, pill.t - 200, pill.w + 400, pill.h + 400);
    outside.addPath(path);
    ctx.clip(outside, 'evenodd');
  }

  function emitEdgeParticles(
    pill: Rect, fill: Rect, edge: number, isBurning: boolean, isFlowing: boolean, now: number,
  ) {
    const dt = (FRAME_MS / 1000) * frameK;
    if (isBurning) {
      const fizzCount = Math.floor(FIZZ_RATE * dt + Math.random());
      for (let i = 0; i < fizzCount; i++) {
        const y = pill.t + Math.random() * pill.h;
        emitBurn(edge + getTornOffset(y, edge, fill.t) + Math.random() * 3, y,
          10 + Math.random() * 20, -(4 + Math.random() * 10), 0,
          0.8 + Math.random() * 0.7, 0.25 + Math.random() * 0.25, 0.9 + Math.random() * 0.1, false, false);
      }
      const trailCount = Math.floor(TRAIL_RATE * dt + Math.random());
      for (let i = 0; i < trailCount; i++) {
        const isSpark = Math.random() < 0.12;
        const y = pill.t + Math.random() * pill.h;
        emitBurn(edge + getTornOffset(y, edge, fill.t) + 2 + Math.random() * 10, y,
          40 + Math.random() * 70, -(10 + Math.random() * 30), -(26 + Math.random() * 34),
          isSpark ? 1.4 + Math.random() * 0.8 : 0.9 + Math.random() * 1.1, 0.6 + Math.random() * 0.7, 1, isSpark, true);
      }
      return;
    }

    if (!isFlowing) return;
    const maxLife = (fillEndsAt + DUST_TAIL_MS - now) / 1000;
    const dustCount = Math.floor(SWEEP_DUST_RATE * dt + Math.random());
    for (let i = 0; i < dustCount; i++) {
      emitDust(edge, pill.t + Math.random() * pill.h, maxLife);
    }
  }

  function emitDust(x: number, y: number, maxLife: number) {
    if (particles.count >= PARTICLE_CAP) return;
    const i = particles.count++;
    const roll = Math.random();
    const kind = roll < 0.65 ? KIND_DUST : roll < 0.9 ? KIND_SPARK : KIND_CHUNK;
    particles.kind[i] = kind;
    particles.isBurn[i] = 0;
    particles.x[i] = x + (Math.random() - 0.5) * 4;
    particles.y[i] = y;
    particles.size[i] = kind === KIND_DUST
      ? 1.4 + Math.random() * 1.6
      : kind === KIND_SPARK ? 0.7 + Math.random() * 0.7 : 3 + Math.random() * 1.5;
    particles.vx[i] = -30 + Math.random() * 80;
    particles.vy[i] = -50 - Math.random() * 100;
    particles.ay[i] = 0;
    particles.life[i] = Math.max(0.05, Math.min(0.3 + Math.random() * 0.2, maxLife));
    particles.age[i] = 0;
    particles.alpha[i] = 1;
  }

  function emitBurn(
    x: number, y: number, vx: number, vy: number, ay: number,
    size: number, life: number, alpha: number, isSpark: boolean, hasWobble: boolean,
  ) {
    if (particles.count >= PARTICLE_CAP) return;
    const i = particles.count++;
    particles.kind[i] = isSpark ? KIND_SPARK : KIND_DUST;
    particles.isBurn[i] = 1;
    particles.x[i] = x;
    particles.sx[i] = x;
    particles.y[i] = y;
    particles.sy[i] = y;
    particles.vx[i] = vx;
    particles.vy[i] = vy;
    particles.ay[i] = ay;
    particles.wobbleFreq[i] = hasWobble ? 4 + Math.random() * 3 : 0;
    particles.wobblePhase[i] = Math.random() * Math.PI * 2;
    particles.size[i] = size;
    particles.life[i] = life;
    particles.age[i] = 0;
    particles.alpha[i] = alpha;
  }

  function emitShatter(area: Rect, pill: Rect) {
    const cx = pill.l + pill.w / 2;
    const cy = pill.t + pill.h / 2;
    const cols = Math.max(1, Math.floor(area.w / SHATTER_STEP));
    const rows = Math.max(1, Math.floor(area.h / SHATTER_STEP));
    const keep = Math.min(1, SHATTER_TARGET / (cols * rows));
    const capRadius = pill.h / 2;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (Math.random() > keep || particles.count >= PARTICLE_CAP) continue;
        const x = area.l + (col + 0.5 + (Math.random() - 0.5) * 0.8) * SHATTER_STEP;
        const y = area.t + (row + 0.5 + (Math.random() - 0.5) * 0.8) * SHATTER_STEP;
        if (x < pill.l + capRadius && Math.hypot(x - (pill.l + capRadius), y - cy) > capRadius) continue;
        const rightCapX = pill.l + pill.w - capRadius;
        if (x > rightCapX && Math.hypot(x - rightCapX, y - cy) > capRadius) continue;

        let dx = x - cx;
        let dy = y - cy;
        const distance = Math.max(1, Math.hypot(dx, dy));
        dx /= distance;
        dy /= distance;
        const speed = 60 + Math.random() * 140;
        const isSpark = Math.random() < 0.15;
        const i = particles.count++;
        particles.kind[i] = isSpark ? KIND_DROPLET_SPARK : KIND_DROPLET;
        particles.isBurn[i] = 0;
        particles.x[i] = x;
        particles.sx[i] = x;
        particles.y[i] = y;
        particles.sy[i] = y;
        particles.vx[i] = dx * speed + (Math.random() - 0.5) * 60;
        particles.vy[i] = dy * speed - (40 + Math.random() * 80) + (Math.random() - 0.5) * 60;
        particles.ay[i] = 0;
        particles.size[i] = isSpark ? 1.4 + Math.random() * 0.8 : 1 + Math.random() * 1.2;
        particles.life[i] = 0.35 + Math.random() * 0.3;
        particles.age[i] = 0;
        particles.alpha[i] = 1;
        particles.wobbleFreq[i] = 0;
        particles.wobblePhase[i] = 0;
      }
    }
  }

  function drawParticles(pill: Rect) {
    const dt = (FRAME_MS / 1000) * frameK;
    const top = pill.t;
    const dustCeiling = top - 40;
    const burnCeiling = top - 48;
    const dropletCeiling = top - 70;
    const damping85 = 0.85 ** frameK;

    for (let i = particles.count - 1; i >= 0; i--) {
      particles.age[i] += dt;
      if (particles.age[i] >= particles.life[i]) {
        removeParticle(i);
        continue;
      }

      const kind = particles.kind[i];
      const isBurn = particles.isBurn[i] === 1;
      if (kind >= KIND_DROPLET) {
        particles.vx[i] *= 1 - 2.4 * dt;
        particles.vy[i] *= 1 - 2.4 * dt;
        if (particles.age[i] > 0.12) particles.vy[i] += 120 * dt;
        if (particles.y[i] < dropletCeiling) particles.vy[i] *= damping85;
      } else if (isBurn) {
        particles.vy[i] += particles.ay[i] * dt;
        particles.vx[i] *= 1 - 1.6 * dt;
        particles.vy[i] *= 1 - 0.8 * dt;
        if (particles.y[i] < burnCeiling) particles.vy[i] *= 0.9 ** frameK;
      } else {
        particles.vy[i] -= 20 * dt;
        particles.vx[i] *= 1 - 3 * dt;
        particles.vy[i] *= 1 - 3 * dt;
        if (particles.y[i] < dustCeiling) particles.vy[i] *= damping85;
      }
      particles.x[i] += particles.vx[i] * dt;
      particles.y[i] += particles.vy[i] * dt;

      const x = particles.x[i];
      const y = particles.y[i];
      const t = particles.age[i] / particles.life[i];

      if (kind >= KIND_DROPLET) {
        let alpha = fadeCurve(t, 0.12, 0.7);
        if (y < dustCeiling) alpha *= Math.max(0, 1 - (dustCeiling - y) / 24);
        if (y < dropletCeiling) alpha *= Math.max(0, 1 - (dropletCeiling - y) / 16);
        const speed = Math.hypot(particles.vx[i], particles.vy[i]);
        const radius = particles.size[i] * (1 - 0.4 * t) / 2;
        const stretch = Math.min(2, 1 + speed / 200);
        fillEllipse(x, y, radius * stretch, radius, Math.atan2(particles.vy[i], particles.vx[i]), alpha);
        if (kind === KIND_DROPLET_SPARK) fillCircle(x, y, radius * 2.2, HALO_ALPHA * alpha);
        continue;
      }

      if (isBurn) {
        const distance = Math.hypot(x - particles.sx[i], y - particles.sy[i]);
        let alpha = fadeCurve(t, 0.08, 0.55) * particles.alpha[i] * Math.exp(-distance / 44);
        if (y < burnCeiling) alpha *= Math.max(0, 1 - (burnCeiling - y) / 16);
        const radius = particles.size[i] / 2 * (1 - 0.4 * Math.min(1, distance / 70));
        const speed = Math.hypot(particles.vx[i], particles.vy[i]);
        let drawX = x;
        let drawY = y;
        if (particles.wobbleFreq[i] > 0 && speed > 1) {
          const wobble = 3 * Math.sin(particles.age[i] * particles.wobbleFreq[i] + particles.wobblePhase[i]);
          drawX += -particles.vy[i] / speed * wobble;
          drawY += particles.vx[i] / speed * wobble;
        }
        const stretch = Math.min(1.8, 1 + speed / 220);
        fillEllipse(drawX, drawY, radius * stretch, radius, Math.atan2(particles.vy[i], particles.vx[i]), alpha);
        if (kind === KIND_SPARK) fillCircle(drawX, drawY, radius * 2.2, HALO_ALPHA * alpha);
        continue;
      }

      let alpha = fadeCurve(t, 0.12, 0.7);
      if (y < dustCeiling) alpha *= Math.max(0, 1 - (dustCeiling - y) / 24);
      const radius = particles.size[i] * (1 - 0.5 * t) / 2;
      fillCircle(x, y, kind === KIND_SPARK ? radius * 2 : radius, alpha);
      if (kind === KIND_SPARK) fillCircle(x, y, radius * 4.4, HALO_ALPHA * alpha);
    }
    ctx.globalAlpha = 1;
  }

  function removeParticle(i: number) {
    const last = --particles.count;
    if (i === last) return;
    particles.x[i] = particles.x[last];
    particles.y[i] = particles.y[last];
    particles.vx[i] = particles.vx[last];
    particles.vy[i] = particles.vy[last];
    particles.ay[i] = particles.ay[last];
    particles.life[i] = particles.life[last];
    particles.age[i] = particles.age[last];
    particles.size[i] = particles.size[last];
    particles.alpha[i] = particles.alpha[last];
    particles.sx[i] = particles.sx[last];
    particles.sy[i] = particles.sy[last];
    particles.wobbleFreq[i] = particles.wobbleFreq[last];
    particles.wobblePhase[i] = particles.wobblePhase[last];
    particles.kind[i] = particles.kind[last];
    particles.isBurn[i] = particles.isBurn[last];
  }

  function fillCircle(x: number, y: number, radius: number, alpha: number) {
    if (alpha <= 0.004 || radius <= 0) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function fillEllipse(x: number, y: number, rx: number, ry: number, angle: number, alpha: number) {
    if (alpha <= 0.004 || rx <= 0 || ry <= 0) return;
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
    ctx.fill();
  }

  function syncPillElement(width: number, scale: number) {
    const roundedWidth = Math.round(width * 100) / 100;
    if (roundedWidth !== lastPillWidth) {
      lastPillWidth = roundedWidth;
      pillElement.style.width = `${roundedWidth}px`;
    }
    const transform = scale === 1 ? '' : `scale(${scale})`;
    if (transform !== lastPillTransform) {
      lastPillTransform = transform;
      pillElement.style.transform = transform;
    }
  }

  function measureFeeWidth() {
    const { feeBefore, feeAfter } = state!;
    ctx.font = fonts.regular;
    return PAD_X + ctx.measureText(feeBefore).width + GAP + STAR_SIZE + GAP + ctx.measureText(feeAfter).width + PAD_X;
  }

  function measureFreePrefixWidth() {
    ctx.font = fonts.medium;
    return STAR_SIZE + GAP + ctx.measureText(state!.free).width + DOT_SPACE + DOT_SIZE + DOT_SPACE;
  }

  function measureFreeWidth(now: number) {
    return PAD_X + measureFreePrefixWidth() + getLabelWidth(now) + PAD_X;
  }

  function drawFeeContent(pill: Rect, color: string) {
    const { feeBefore, feeAfter } = state!;
    const baseline = getBaseline(pill);
    ctx.font = fonts.regular;
    ctx.fillStyle = color;
    const beforeX = pill.l + PAD_X;
    const starX = beforeX + ctx.measureText(feeBefore).width + GAP;
    const afterX = starX + STAR_SIZE + GAP;
    fillUprightText(feeBefore, beforeX, baseline);
    drawStar(starX, pill.t + pill.h / 2, color, false);
    fillUprightText(feeAfter, afterX, baseline);
  }

  function drawFreeContent(pill: Rect, color: string, now: number) {
    const baseline = getBaseline(pill);
    const cy = pill.t + pill.h / 2;
    let x = pill.l + PAD_X;
    drawStar(x, cy, color, true);
    x += STAR_SIZE + GAP;
    ctx.font = fonts.medium;
    ctx.fillStyle = color;
    fillUprightText(state!.free, x, baseline);
    x += ctx.measureText(state!.free).width + DOT_SPACE;

    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * DETAIL_SEPARATOR_ALPHA;
    ctx.beginPath();
    ctx.arc(x + DOT_SIZE / 2, cy, DOT_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha;
    x += DOT_SIZE + DOT_SPACE;

    drawLabel(x, baseline, cy, color, now);
  }

  function drawStar(x: number, cy: number, color: string, isCrossed: boolean) {
    const scale = STAR_SIZE / ICON_BOX;
    ctx.save();
    flipBlock(x, STAR_SIZE);
    ctx.fillStyle = color;
    ctx.translate(x, cy - STAR_SIZE / 2);
    ctx.scale(scale, scale);
    ctx.fill(isCrossed ? starCrossedPath : starPath);
    ctx.restore();
  }

  function flipBlock(x: number, width: number) {
    if (!state!.isRtl) return;
    ctx.translate(2 * x + width, 0);
    ctx.scale(-1, 1);
  }

  function fillUprightText(text: string, x: number, baseline: number) {
    ctx.save();
    flipBlock(x, ctx.measureText(text).width);
    ctx.fillText(text, x, baseline);
    ctx.restore();
  }

  function setLabel(text: string, isAnimated: boolean, now: number) {
    ctx.font = fonts.regular;
    const width = measureTabularText(text);
    if (!label || !isAnimated) {
      label = {
        text, fromText: text, runs: [{ text, x: 0 }], flips: [], width, fromWidth: width, startedAt: now,
      };
      return;
    }
    if (text === label.text) return;

    const fromWidth = getLabelWidth(now);
    const offset = label.text.length - text.length;
    const runs: LabelRun[] = [];
    const flips: LabelFlip[] = [];
    let runStart = 0;
    for (let i = 0; i < text.length; i++) {
      const oldChar = label.text[i + offset];
      if (oldChar === undefined || oldChar === text[i]) continue;
      if (i > runStart) runs.push({ text: text.slice(runStart, i), x: measureTabularText(text.slice(0, runStart)) });
      flips.push({
        char: text[i], oldChar, x: measureTabularText(text.slice(0, i)), index: i,
      });
      runStart = i + 1;
    }
    if (runStart < text.length) {
      runs.push({ text: text.slice(runStart), x: measureTabularText(text.slice(0, runStart)) });
    }
    label = {
      text, fromText: label.text, runs, flips, width, fromWidth, startedAt: now,
    };
  }

  function getLabelProgress(now: number) {
    return label ? clamp01((now - label.startedAt) / FLIP_MS) : 1;
  }

  function getIsLabelAnimating(now: number) {
    return Boolean(label) && getLabelProgress(now) < 1 && (label.flips.length > 0 || label.fromWidth !== label.width);
  }

  function getLabelWidth(now: number) {
    if (!label) return 0;
    return lerp(label.fromWidth, label.width, getCssEaseOut(getLabelProgress(now)));
  }

  function drawLabel(x0: number, baseline: number, cy: number, color: string, now: number) {
    if (!label) return;

    ctx.font = fonts.regular;
    ctx.fillStyle = color;
    if (state!.isRtl) {
      drawRtlLabel(label, x0, baseline, cy, now);
      return;
    }

    label.runs.forEach((run) => fillTabularText(run.text, x0 + run.x, baseline));

    const progress = getLabelProgress(now);
    const eased = getCssEaseOut(progress);
    const alpha = ctx.globalAlpha;
    label.flips.forEach((flip) => {
      if (progress >= 1) {
        fillTabularText(flip.char, x0 + flip.x, baseline);
        return;
      }
      const x = x0 + flip.x;
      drawFlippedChar(flip.oldChar, x, baseline, cy, FLIP_SHIFT * eased, -FLIP_ANGLE * eased, alpha * (1 - eased));
      drawFlippedChar(flip.char, x, baseline, cy, -FLIP_SHIFT * (1 - eased), FLIP_ANGLE * (1 - eased), alpha * eased);
    });
    ctx.globalAlpha = alpha;
  }

  function drawRtlLabel(current: Label, x0: number, baseline: number, cy: number, now: number) {
    const progress = getLabelProgress(now);
    const eased = getCssEaseOut(progress);
    const alpha = ctx.globalAlpha;
    const outShift = FLIP_SHIFT * eased;
    const outAngle = -FLIP_ANGLE * eased;
    const inShift = -FLIP_SHIFT * (1 - eased);
    const inAngle = FLIP_ANGLE * (1 - eased);
    const isTextRolling = progress < 1
      && current.flips.some(({ char, oldChar }) => !getIsDigitRun(char) || !getIsDigitRun(oldChar));

    if (isTextRolling) {
      ctx.save();
      flipBlock(x0, ctx.measureText(current.fromText).width);
      drawFlippedChar(current.fromText, x0, baseline, cy, outShift, outAngle, alpha * (1 - eased), true);
      ctx.restore();
      ctx.save();
      flipBlock(x0, ctx.measureText(current.text).width);
      drawFlippedChar(current.text, x0, baseline, cy, inShift, inAngle, alpha * eased, true);
      ctx.restore();
      return;
    }

    let runStart = 0;
    for (const run of current.text.match(TIME_RUNS_REGEX) || []) {
      const x = x0 + measureTabularText(current.text.slice(0, runStart));
      if (getIsDigitRun(run)) {
        ctx.save();
        flipBlock(x, measureTabularText(run));
        for (let i = runStart; i < runStart + run.length; i++) {
          const charX = x0 + measureTabularText(current.text.slice(0, i));
          const flip = progress < 1 ? current.flips.find(({ index }) => index === i) : undefined;
          if (flip) {
            drawFlippedChar(flip.oldChar, charX, baseline, cy, outShift, outAngle, alpha * (1 - eased));
            drawFlippedChar(flip.char, charX, baseline, cy, inShift, inAngle, alpha * eased);
            ctx.globalAlpha = alpha;
          } else {
            fillTabularText(current.text[i], charX, baseline);
          }
        }
        ctx.restore();
      } else {
        fillUprightText(run, x, baseline);
      }
      runStart += run.length;
    }
  }

  function drawFlippedChar(
    char: string, x: number, baseline: number, cy: number, shift: number, angle: number, alpha: number,
    isBidiText?: boolean,
  ) {
    if (alpha <= 0) return;

    const width = getIsDigitRun(char) ? digitCell : ctx.measureText(char).width;
    const cx = x + width / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const stripHeight = (2 * lineHalf) / FLIP_STRIPS;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < FLIP_STRIPS; i++) {
      const offset = i * stripHeight - lineHalf;
      const [top, topScale] = projectFlip(offset, cos, sin, shift);
      const [bottom, bottomScale] = projectFlip(offset + stripHeight, cos, sin, shift);
      const scaleX = (topScale + bottomScale) / 2;
      const scaleY = (bottom - top) / stripHeight;
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - width * scaleX, cy + top, 2 * width * scaleX, bottom - top);
      ctx.clip();
      ctx.transform(scaleX, 0, 0, scaleY, cx - cx * scaleX, cy + top - (cy + offset) * scaleY);
      if (isBidiText) {
        ctx.fillText(char, x, baseline);
      } else {
        fillTabularText(char, x, baseline);
      }
      ctx.restore();
    }
  }

  function measureTabularText(text: string) {
    let width = 0;
    for (const run of text.match(DIGIT_RUNS_REGEX) || []) {
      width += getIsDigitRun(run) ? run.length * digitCell : ctx.measureText(run).width;
    }
    return width;
  }

  function fillTabularText(text: string, x: number, y: number) {
    let cursor = x;
    for (const run of text.match(DIGIT_RUNS_REGEX) || []) {
      if (!getIsDigitRun(run)) {
        ctx.fillText(run, cursor, y);
        cursor += ctx.measureText(run).width;
        continue;
      }
      for (const digit of run) {
        ctx.fillText(digit, cursor + (digitCell - digitWidths[Number(digit)]) / 2, y);
        cursor += digitCell;
      }
    }
  }

  function getBaseline(pill: Rect) {
    return pill.t + pill.h / 2 + baselineShift;
  }

  function destroy() {
    isDestroyed = true;
    window.clearTimeout(secondTimeout);
  }

  return { update, setColors, destroy };
}

function createParticles(): Particles {
  return {
    x: new Float32Array(PARTICLE_CAP),
    y: new Float32Array(PARTICLE_CAP),
    vx: new Float32Array(PARTICLE_CAP),
    vy: new Float32Array(PARTICLE_CAP),
    ay: new Float32Array(PARTICLE_CAP),
    life: new Float32Array(PARTICLE_CAP),
    age: new Float32Array(PARTICLE_CAP),
    size: new Float32Array(PARTICLE_CAP),
    alpha: new Float32Array(PARTICLE_CAP),
    sx: new Float32Array(PARTICLE_CAP),
    sy: new Float32Array(PARTICLE_CAP),
    wobbleFreq: new Float32Array(PARTICLE_CAP),
    wobblePhase: new Float32Array(PARTICLE_CAP),
    kind: new Uint8Array(PARTICLE_CAP),
    isBurn: new Uint8Array(PARTICLE_CAP),
    count: 0,
  };
}

function roundRectPath(rect: Rect, radius: number) {
  const path = new Path2D();
  path.roundRect(rect.l, rect.t, rect.w, rect.h, radius);
  return path;
}

function fadeCurve(t: number, fadeIn: number, exponent: number) {
  return t < fadeIn ? t / fadeIn : (1 - (t - fadeIn) / (1 - fadeIn)) ** exponent;
}

function getTornOffset(y: number, edge: number, top: number) {
  const u = (y - top) / 1.7;
  const v = edge / 3.2;
  const noise = 0.68 * valueNoise(u, v, 17) + 0.32 * valueNoise(u * 2.6, v * 1.7, 91);
  return (noise - 0.5) * TORN_AMPLITUDE;
}

function valueNoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = getSmoothStep(x - xi);
  const fy = getSmoothStep(y - yi);
  const a = hash01(xi, yi, seed);
  const b = hash01(xi + 1, yi, seed);
  const c = hash01(xi, yi + 1, seed);
  const d = hash01(xi + 1, yi + 1, seed);
  const ab = a + (b - a) * fx;
  const cd = c + (d - c) * fx;
  return ab + (cd - ab) * fy;
}

function hash01(x: number, y: number, seed: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) & 0xFFFF) / 65535;
}

function projectFlip(offset: number, cos: number, sin: number, shift: number): [number, number] {
  const scale = FLIP_PERSPECTIVE / (FLIP_PERSPECTIVE - offset * sin);
  return [(offset * cos + shift) * scale, scale];
}

function getCssEaseOut(progress: number) {
  let t = progress;
  for (let i = 0; i < EASE_OUT_STEPS; i++) {
    const x = 3 * EASE_OUT_CONTROL * t * t * (1 - t) + t ** 3;
    const slope = 3 * EASE_OUT_CONTROL * t * (2 - 3 * t) + 3 * t * t;
    if (!slope) break;
    t = clamp01(t - (x - progress) / slope);
  }
  return 3 * t * t - 2 * t ** 3;
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function getIsDigitRun(run: string) {
  return run[0] >= '0' && run[0] <= '9';
}
