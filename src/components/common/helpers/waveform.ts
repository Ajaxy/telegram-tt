type IWaveformProps = {
  peak: number;
  fillStyle: string;
  progressFillStyle: string;
};

export const MAX_EMPTY_WAVEFORM_POINTS = 30;
const SPIKE_WIDTH = 2;
const SPIKE_STEP = 4;
const SPIKE_RADIUS = 1;
const HEIGHT = 23;

export function renderWaveform(
  canvas: HTMLCanvasElement,
  spikes: number[],
  progress: number,
  {
    peak, fillStyle, progressFillStyle,
  }: IWaveformProps,
) {
  const width = spikes.length * SPIKE_STEP;
  const height = HEIGHT;

  canvas.width = width * 2;
  canvas.height = height * 2;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d')!;
  ctx.scale(2, 2);

  spikes.forEach((item, i) => {
    ctx.globalAlpha = (i / spikes.length >= progress) ? 0.5 : 1;
    ctx.fillStyle = progress > i / spikes.length ? progressFillStyle : fillStyle;
    const spikeHeight = Math.max(2, HEIGHT * (item / Math.max(1, peak)));
    roundedRectangle(ctx, i * SPIKE_STEP, (height + spikeHeight) / 2, SPIKE_WIDTH, spikeHeight, SPIKE_RADIUS);
    ctx.fill();
  });
}

function roundedRectangle(
  ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number,
) {
  if (width < 2 * radius) {
    radius = width / 2;
  }
  if (height < 2 * radius) {
    radius = height / 2;
  }

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y - height, radius);
  ctx.arcTo(x + width, y - height, x, y - height, radius);
  ctx.arcTo(x, y - height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
