import { requestMeasure, requestMutation } from '../../lib/fasterdom/fasterdom';

const BAR_WIDTH = 3;
const BAR_GAP = 3;
// Radius of half the width turns minimum-height bars (silence) into round dots
const BAR_RADIUS = BAR_WIDTH / 2;
const MIN_BAR_HEIGHT = BAR_WIDTH;
// Keep the loudest bars from touching the canvas edges
const MAX_BAR_HEIGHT_RATIO = 0.8;
const UNPLAYED_ALPHA = 0.3;
const INITIAL_MAX_PEAK = 0.05;

export default class LiveWaveformRenderer {
  private canvas: HTMLCanvasElement;

  private ctx: CanvasRenderingContext2D;

  private peaks: number[] = [];

  private maxPeak = INITIAL_MAX_PEAK;

  private capacity = 0;

  private cssWidth = 0;

  private cssHeight = 0;

  private dpr = 1;

  private color = '';

  private progress?: number;

  private isDrawScheduled = false;

  private isSeekable = false;

  private isDestroyed = false;

  private cleanupDrag?: NoneToVoidFunction;

  onSeek?: (progress: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    requestMeasure(() => {
      if (this.isDestroyed) return;
      const rect = this.canvas.getBoundingClientRect();
      this.color = getComputedStyle(this.canvas).color;
      this.applySize(rect.width, rect.height);
    });

    canvas.addEventListener('pointerdown', this.handlePointerDown);
  }

  handleResize(width: number, height: number) {
    this.applySize(width, height);
  }

  setSeekable(isSeekable: boolean) {
    this.isSeekable = isSeekable;
    requestMutation(() => {
      if (this.isDestroyed) return;
      this.canvas.style.cursor = isSeekable ? 'pointer' : '';
    });
  }

  pushPeak(value: number) {
    if (value > this.maxPeak) this.maxPeak = value;
    const normalized = Math.min(1, value / this.maxPeak);
    this.peaks.push(normalized);
    if (this.capacity && this.peaks.length > this.capacity) {
      this.peaks.splice(0, this.peaks.length - this.capacity);
    }
    this.scheduleDraw();
  }

  setPeaks(peaks: ArrayLike<number>) {
    const cap = this.capacity || 1;

    const fitted: number[] = [];
    if (peaks.length <= cap) {
      for (let i = 0; i < peaks.length; i++) fitted.push(peaks[i]);
    } else {
      const ratio = peaks.length / cap;
      for (let i = 0; i < cap; i++) {
        const start = Math.floor(i * ratio);
        const end = Math.floor((i + 1) * ratio);
        let peak = 0;
        for (let j = start; j < end && j < peaks.length; j++) {
          if (peaks[j] > peak) peak = peaks[j];
        }
        fitted.push(peak);
      }
    }

    let max = 0.001;
    for (let i = 0; i < fitted.length; i++) if (fitted[i] > max) max = fitted[i];
    for (let i = 0; i < fitted.length; i++) fitted[i] = Math.min(1, fitted[i] / max);

    this.peaks = fitted;
    this.scheduleDraw();
  }

  setProgress(progress?: number) {
    this.progress = progress;
    this.scheduleDraw();
  }

  destroy() {
    this.isDestroyed = true;
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.cleanupDrag?.();
    this.peaks = [];
  }

  private handlePointerDown = (e: PointerEvent) => {
    if (!this.isSeekable || !this.onSeek) return;
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0) return;

    const seekTo = (clientX: number) => {
      this.onSeek!(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
    };

    seekTo(e.clientX);

    const handleMove = (moveEvent: PointerEvent) => seekTo(moveEvent.clientX);
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      this.cleanupDrag = undefined;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    this.cleanupDrag = handleUp;
  };

  private applySize(width: number, height: number) {
    if (width <= 0) return;

    this.cssWidth = width;
    this.cssHeight = height;
    this.dpr = window.devicePixelRatio || 1;
    this.capacity = Math.max(1, Math.floor((this.cssWidth + BAR_GAP) / (BAR_WIDTH + BAR_GAP)));

    if (this.peaks.length > this.capacity) {
      this.peaks.splice(0, this.peaks.length - this.capacity);
    }

    requestMutation(() => {
      if (this.isDestroyed) return;
      this.canvas.width = Math.round(this.cssWidth * this.dpr);
      this.canvas.height = Math.round(this.cssHeight * this.dpr);
      this.draw();
    });
  }

  private scheduleDraw() {
    if (this.isDrawScheduled) return;
    this.isDrawScheduled = true;
    requestMutation(() => {
      this.isDrawScheduled = false;
      if (this.isDestroyed) return;
      this.draw();
    });
  }

  private draw() {
    const w = this.cssWidth;
    const h = this.cssHeight;
    if (!w || !h) return;

    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (!this.peaks.length) return;

    const stride = BAR_WIDTH + BAR_GAP;
    const totalWidth = this.peaks.length * stride - BAR_GAP;
    const startX = Math.max(0, w - totalWidth);
    const midY = h / 2;

    ctx.fillStyle = this.color;

    const hasProgress = this.progress !== undefined;
    const progressPx = hasProgress
      ? startX + Math.max(0, Math.min(1, this.progress!)) * totalWidth
      : Infinity;

    const { dpr } = this;
    const snap = (value: number) => Math.round(value * dpr) / dpr;

    const maxBarHeight = h * MAX_BAR_HEIGHT_RATIO;
    for (let i = 0; i < this.peaks.length; i++) {
      const x = snap(startX + i * stride);
      const barH = snap(Math.max(MIN_BAR_HEIGHT, Math.min(maxBarHeight, this.peaks[i] * maxBarHeight)));
      const y = snap(midY - barH / 2);

      ctx.globalAlpha = !hasProgress || x + BAR_WIDTH / 2 <= progressPx ? 1 : UNPLAYED_ALPHA;

      ctx.beginPath();
      ctx.roundRect(x, y, BAR_WIDTH, barH, BAR_RADIUS);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }
}
