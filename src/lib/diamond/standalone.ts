import type { DiamondDrawState } from './model';
import type { StarBurst } from './stars';

import DiamondMotion from './motion';
import {
  registerStandaloneDiamond, unregisterStandaloneDiamond, updateStandaloneDiamondPlayback,
} from './standaloneGpu';
import { STAR_BURST_DURATION } from './stars';

type StandaloneDiamondOptions = {
  // CSS pixels of the square canvas, which leaves room around the diamond to grow and to salute
  canvasSize: number;
  // CSS pixels of the diamond frame at scale 1, which a diamond icon of this size fills
  size: number;
  // Radians per second
  speed?: number;
  sway?: number;
  // Share of a full salute, 0..1
  burstSize?: number;
  onReady?: NoneToVoidFunction;
  onFallback?: NoneToVoidFunction;
};

const MAX_PIXEL_RATIO = 2;
const DEFAULT_KICK_DECAY = 0.7;
const THROW_VELOCITY = 600;
const MAX_BURSTS = 3;
const SEED_RANGE = 65536;
const SCALE_STEP = 1 / 240;
const SCALE_FREQUENCY = 14;
const SCALE_DAMPING = 0.42;

// A diamond on its own canvas, drawn with WebGPU. It turns, nods and salutes on its own, and hands its pose over to
// another diamond with `adopt`.
export default class StandaloneDiamond {
  readonly canvas: HTMLCanvasElement;

  // Device pixels
  readonly frameSize: number;

  motion = new DiamondMotion();

  drawState: DiamondDrawState = {};

  bursts: StarBurst[] = [];

  // Seconds of drawing, the clock of the facet light, the sway and the salutes
  elapsed = 0;

  scale = 1;

  speed: number;

  burstSize: number;

  starOpacity = 1;

  isPaused = false;

  isStoneHidden = false;

  onReady?: NoneToVoidFunction;

  onFallback?: NoneToVoidFunction;

  private readonly canvasSize: number;

  private targetScale = 1;

  private scaleVelocity = 0;

  private nextSeed = 1;

  constructor(canvas: HTMLCanvasElement, options: StandaloneDiamondOptions) {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const canvasPixels = Math.round(options.canvasSize * pixelRatio);

    canvas.width = canvasPixels;
    canvas.height = canvasPixels;
    this.canvas = canvas;
    this.canvasSize = options.canvasSize;
    this.frameSize = options.size * pixelRatio;
    this.speed = options.speed ?? 0;
    this.motion.swayScale = options.sway ?? 1;
    this.burstSize = options.burstSize ?? 1;
    this.onReady = options.onReady;
    this.onFallback = options.onFallback;

    registerStandaloneDiamond(this);
  }

  setScale(scale: number, isAnimated?: boolean) {
    this.targetScale = scale;
    if (isAnimated) return;

    this.scale = scale;
    this.scaleVelocity = 0;
  }

  setSway(sway: number) {
    this.motion.swayScale = sway;
  }

  setIsPaused(isPaused: boolean) {
    this.isPaused = isPaused;
    updateStandaloneDiamondPlayback();
  }

  // Radians per second, added to the turn and weakening e times in `decay` seconds
  kick(velocity: number, decay = DEFAULT_KICK_DECAY) {
    this.motion.spin(velocity, decay);
  }

  burst() {
    if (this.bursts.length >= MAX_BURSTS) this.bursts.shift();

    this.bursts.push({ startTime: this.elapsed, seed: this.nextSeed });
    this.nextSeed = (this.nextSeed + 1) % SEED_RANGE;
  }

  // The clock goes along with the pose, so the facets and the sparkle go on instead of starting over
  adopt(other: StandaloneDiamond) {
    const { swayScale } = this.motion;

    this.motion = other.motion.clone();
    this.motion.swayScale = swayScale;
    this.elapsed = other.elapsed;
    this.drawState = { ...other.drawState };
  }

  beginDrag() {
    this.motion.begin(getNow());
  }

  // CSS pixels
  drag(deltaX: number, deltaY: number) {
    this.motion.drag(deltaX, deltaY, this.canvasSize, getNow());
  }

  // A throw spins the diamond up and salutes
  endDrag(velocityX: number, isCancelled?: boolean) {
    this.motion.end(getNow(), isCancelled);
    if (isCancelled || Math.abs(velocityX) <= THROW_VELOCITY) return;

    this.motion.fling(Math.sign(velocityX));
    this.burst();
  }

  advance(duration: number) {
    this.elapsed += duration;

    for (let rest = duration; rest > 0; rest -= SCALE_STEP) {
      const step = Math.min(rest, SCALE_STEP);
      this.scaleVelocity += ((this.targetScale - this.scale) * SCALE_FREQUENCY * SCALE_FREQUENCY
        - 2 * SCALE_DAMPING * SCALE_FREQUENCY * this.scaleVelocity) * step;
      this.scale += this.scaleVelocity * step;
    }

    while (this.bursts.length && this.elapsed - this.bursts[0].startTime >= STAR_BURST_DURATION) this.bursts.shift();
    this.motion.step(duration, this.speed, this.elapsed);
  }

  destroy() {
    unregisterStandaloneDiamond(this);
  }
}

function getNow() {
  return performance.now() / 1000;
}
