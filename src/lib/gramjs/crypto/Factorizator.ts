import { BigMath, modExp, randBetweenBigInt } from '../Helpers';

export class Factorizator {
  /**
     * Calculates the greatest common divisor
     * @param a {bigint}
     * @param b {bigint}
     * @returns {bigint}
     */
  static gcd(a: bigint, b: bigint) {
    while (b !== 0n) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a;
  }

  /**
     * Factorizes the given number and returns both the divisor and the number divided by the divisor
     * @param pq {bigint}
     * @returns {{p: *, q: *}}
     */
  static factorize(pq: bigint) {
    if (pq % 2n === 0n) {
      return { p: 2n, q: pq / 2n };
    }
    let y = randBetweenBigInt(1n, pq - 1n);
    const c = randBetweenBigInt(1n, pq - 1n);
    const m = randBetweenBigInt(1n, pq - 1n);

    let g = 1n;
    let r = 1n;
    let q = 1n;
    let x = 0n;
    let ys = 0n;
    let k: bigint;

    while (g === 1n) {
      x = y;
      for (let i = 0n; i < r; i++) {
        y = (modExp(y, 2n, pq) + c) % pq;
      }
      k = 0n;

      while (k < r && g === 1n) {
        ys = y;
        const condition = BigMath.min(m, r - k);
        for (let i = 0n; i < condition; i++) {
          y = (modExp(y, 2n, pq) + c) % pq;
          q = (q * BigMath.abs(x - y)) % pq;
        }
        g = Factorizator.gcd(q, pq);
        k = k + m;
      }

      r = r * 2n;
    }

    if (g === pq) {
      while (true) {
        ys = (modExp(ys, 2n, pq) + c) % pq;
        g = Factorizator.gcd(BigMath.abs(x - ys), pq);

        if (g > 1n) {
          break;
        }
      }
    }
    const p = g;
    q = pq / g;
    return p < q ? { p, q } : { p: q, q: p };
  }
}
