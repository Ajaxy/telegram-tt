type LovelyChartConstructor = typeof import('lovely-chart').default;

let lovelyChartPromise: Promise<LovelyChartConstructor> | undefined;

export default function ensureLovelyChart() {
  if (!lovelyChartPromise) {
    lovelyChartPromise = import('lovely-chart').then(({ default: LovelyChart }) => LovelyChart);
  }

  return lovelyChartPromise;
}
