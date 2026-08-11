import { SecurityError } from '../errors';

import { modExp } from '../Helpers';

const MAX_FACTORIZATION_ATTEMPTS = 8;
const MAX_FACTORIZATION_STEPS = 250_000;
const FACTORIZATION_BATCH_SIZE = 128;
const PRIME_WITNESSES = [2n, 325n, 9375n, 28178n, 450775n, 9780504n, 1795265022n];
const SMALL_PRIMES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];

export class Factorizator {
  static factorize(pq: bigint) {
    if (pq < 15n || pq % 2n === 0n || isPrime(pq)) {
      throw new SecurityError('Invalid pq value');
    }

    // Bound Pollard-Brent work because `pq` is unauthenticated
    // https://core.telegram.org/mtproto/auth_key#proof-of-work
    for (let attempt = 0; attempt < MAX_FACTORIZATION_ATTEMPTS; attempt++) {
      const factor = findFactor(pq, attempt);
      if (factor === undefined) continue;

      const cofactor = pq / factor;
      const p = factor < cofactor ? factor : cofactor;
      const q = factor < cofactor ? cofactor : factor;
      if (
        p === q
        || p % 2n === 0n
        || p * q !== pq
        || !isPrime(p)
        || !isPrime(q)
      ) {
        throw new SecurityError('pq must contain two distinct odd primes');
      }

      return { p, q };
    }

    throw new SecurityError('pq factorization exceeded work limit');
  }
}

function findFactor(pq: bigint, attempt: number) {
  let value = BigInt(attempt + 2);
  const increment = BigInt(attempt * 2 + 1);
  let factor = 1n;
  let range = 1;
  let steps = 0;
  let savedValue = value;
  let startValue = value;

  while (factor === 1n && steps < MAX_FACTORIZATION_STEPS) {
    startValue = value;
    for (let i = 0; i < range && steps < MAX_FACTORIZATION_STEPS; i++) {
      value = advanceValue(value, increment, pq);
      steps++;
    }

    for (
      let offset = 0;
      offset < range && factor === 1n && steps < MAX_FACTORIZATION_STEPS;
    ) {
      savedValue = value;
      const batchSize = Math.min(FACTORIZATION_BATCH_SIZE, range - offset);
      let product = 1n;
      for (let i = 0; i < batchSize && steps < MAX_FACTORIZATION_STEPS; i++) {
        value = advanceValue(value, increment, pq);
        product = (product * getAbsoluteDifference(startValue, value)) % pq;
        steps++;
      }
      factor = calculateGcd(product, pq);
      offset += batchSize;
    }

    range *= 2;
  }

  if (factor > 1n && factor < pq) return factor;
  if (factor !== pq) return undefined;

  while (steps < MAX_FACTORIZATION_STEPS) {
    savedValue = advanceValue(savedValue, increment, pq);
    factor = calculateGcd(getAbsoluteDifference(startValue, savedValue), pq);
    steps++;
    if (factor > 1n && factor < pq) return factor;
  }

  return undefined;
}

function isPrime(value: bigint) {
  if (value < 2n) return false;

  for (const prime of SMALL_PRIMES) {
    if (value === prime) return true;
    if (value % prime === 0n) return false;
  }

  let oddPart = value - 1n;
  let powerOfTwo = 0;
  while (oddPart % 2n === 0n) {
    oddPart /= 2n;
    powerOfTwo++;
  }

  for (const witness of PRIME_WITNESSES) {
    const normalizedWitness = witness % value;
    if (normalizedWitness === 0n) continue;

    let remainder = modExp(normalizedWitness, oddPart, value);
    if (remainder === 1n || remainder === value - 1n) continue;

    let hasPassedWitness = false;
    for (let exponent = 1; exponent < powerOfTwo; exponent++) {
      remainder = (remainder * remainder) % value;
      if (remainder === value - 1n) {
        hasPassedWitness = true;
        break;
      }
    }
    if (!hasPassedWitness) return false;
  }

  return true;
}

function advanceValue(value: bigint, increment: bigint, modulus: bigint) {
  return (value * value + increment) % modulus;
}

function calculateGcd(first: bigint, second: bigint) {
  while (second !== 0n) {
    const remainder = first % second;
    first = second;
    second = remainder;
  }
  return first;
}

function getAbsoluteDifference(first: bigint, second: bigint) {
  return first > second ? first - second : second - first;
}
