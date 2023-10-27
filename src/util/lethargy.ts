/**
 * Lethargy help distinguish between scroll events initiated by the user, and those by inertial scrolling.
 * Lethargy does not have external dependencies.
 *
 * @param stability - Specifies the length of the rolling average.
 * In effect, the larger the value, the smoother the curve will be.
 * This attempts to prevent anomalies from firing 'real' events. Valid values are all positive integers,
 * but in most cases, you would need to stay between 5 and around 30.
 *
 * @param sensitivity - Specifies the minimum value for wheelDelta for it to register as a valid scroll event.
 * Because the tail of the curve have low wheelDelta values,
 * this will stop them from registering as valid scroll events.
 * The unofficial standard wheelDelta is 120, so valid values are positive integers below 120.
 *
 * @param tolerance - Prevent small fluctuations from affecting results.
 * Valid values are decimals from 0, but should ideally be between 0.05 and 0.3.
 *
 * Based on https://github.com/d4nyll/lethargy
 */

export type LethargyConfig = {
  stability?: number;
  sensitivity?: number;
  tolerance?: number;
  delay?: number;
};

export class Lethargy {
  stability: number;

  sensitivity: number;

  tolerance: number;

  delay: number;

  lastUpDeltas: Array<number>;

  lastDownDeltas: Array<number>;

  deltasTimestamp: Array<number>;

  constructor({
    stability = 8,
    sensitivity = 100,
    tolerance = 1.1,
    delay = 150,
  }: LethargyConfig = {}) {
    this.stability = stability;
    this.sensitivity = sensitivity;
    this.tolerance = tolerance;
    this.delay = delay;
    this.lastUpDeltas = new Array(this.stability * 2).fill(0);
    this.lastDownDeltas = new Array(this.stability * 2).fill(0);
    this.deltasTimestamp = new Array(this.stability * 2).fill(0);
  }

  check(e: any) {
    let lastDelta;
    e = e.originalEvent || e;
    if (e.wheelDelta !== undefined) {
      lastDelta = e.wheelDelta;
    } else if (e.deltaY !== undefined) {
      lastDelta = e.deltaY * -40;
    } else if (e.detail !== undefined || e.detail === 0) {
      lastDelta = e.detail * -40;
    }
    this.deltasTimestamp.push(Date.now());
    this.deltasTimestamp.shift();
    if (lastDelta > 0) {
      this.lastUpDeltas.push(lastDelta);
      this.lastUpDeltas.shift();
      return this.isInertia(1);
    } else {
      this.lastDownDeltas.push(lastDelta);
      this.lastDownDeltas.shift();
      return this.isInertia(-1);
    }
  }

  isInertia(direction: number) {
    const lastDeltas = direction === -1 ? this.lastDownDeltas : this.lastUpDeltas;
    if (lastDeltas[0] === undefined) return direction;
    if (
      this.deltasTimestamp[this.stability * 2 - 2] + this.delay > Date.now()
      && lastDeltas[0] === lastDeltas[this.stability * 2 - 1]
    ) {
      return false;
    }
    const lastDeltasOld = lastDeltas.slice(0, this.stability);
    const lastDeltasNew = lastDeltas.slice(this.stability, this.stability * 2);
    const oldSum = lastDeltasOld.reduce((t, s) => t + s);
    const newSum = lastDeltasNew.reduce((t, s) => t + s);
    const oldAverage = oldSum / lastDeltasOld.length;
    const newAverage = newSum / lastDeltasNew.length;
    return Math.abs(oldAverage) <= Math.abs(newAverage * this.tolerance)
      && this.sensitivity < Math.abs(newAverage);
  }
}
