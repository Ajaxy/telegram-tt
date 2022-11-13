const RANDOM = 0.95;
const DEBOUNCE = 3000;

export default class FrameDebugger {
  private durations: number[] = [];

  private startedAtByFrameKey: Record<string, number | undefined> = {};

  private passedFrames: string[] = [];

  private timeout: number | undefined;

  constructor(private name: string = '[No name]') {
  }

  onFrameStart(frameKey = '0') {
    if (this.passedFrames.includes(frameKey)) {
      // debugger
    }

    if (this.startedAtByFrameKey[frameKey]) {
      return;
    }

    this.startedAtByFrameKey[frameKey] = performance.now();
  }

  onFrameEnd(frameKey = '0', onAnimationEnd?: AnyToVoidFunction) {
    if (!this.startedAtByFrameKey[frameKey]) {
      return;
    }

    const duration = performance.now() - this.startedAtByFrameKey[frameKey]!;

    if (this.passedFrames.includes(frameKey)) {
      // debugger
    }

    this.passedFrames.push(frameKey);
    this.durations.push(duration);

    this.startedAtByFrameKey[frameKey] = undefined;

    if (Math.random() < RANDOM) {
      return;
    }

    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    // eslint-disable-next-line no-restricted-globals
    this.timeout = self.setTimeout(() => {
      if (!this.durations.length) {
        return;
      }

      const max = Math.max(...this.durations);
      const min = Math.max(...this.durations);
      const maxIndex = this.durations.indexOf(max);
      const minIndex = this.durations.indexOf(min);
      const reduced = this.durations.slice();
      reduced.splice(maxIndex, 1);
      reduced.splice(minIndex, 1);
      const avg = reduced.reduce((acc, cur) => acc + cur, 0) / this.durations.length;

      // eslint-disable-next-line no-console
      console.log(
        '!!!',
        this.name,
        'total frames:',
        this.durations.length,
        ', avg duration:',
        avg.toFixed(2),
        ', max duration:',
        Math.max(...reduced).toFixed(2),
        ', min duration:',
        Math.min(...reduced).toFixed(2),
      );

      onAnimationEnd?.();

      this.reset();
    }, DEBOUNCE);
  }

  reset() {
    this.durations = [];

    this.startedAtByFrameKey = {};

    this.passedFrames = [];

    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }
}
