import { DEBUG } from '../config';

// A `bigint` is written as an object with this single key. Strings in the state may come from anyone,
// so they are never converted on restore, and no property name in the state contains a null character.
const BIGINT_JSON_KEY = '\u0000bigint';
const BIGINT_DIGITS_REGEX = /^-?\d+$/;
const PERMILLE_DIVISOR = 1000n;

export function toJSNumber(value: undefined): undefined;
export function toJSNumber(value: bigint): number;
export function toJSNumber(value?: bigint): number | undefined;
export function toJSNumber(value?: bigint): number | undefined {
  if (value === undefined) return undefined;

  if (DEBUG && (value < Number.MIN_SAFE_INTEGER || value > Number.MAX_SAFE_INTEGER)) {
    // eslint-disable-next-line no-console
    console.error('Unsafe BigInt conversion', value);
  }

  return Number(value);
}

export function getBigIntAbs(value: bigint) {
  return value < 0n ? -value : value;
}

export function getBigIntMax(left: bigint, right: bigint) {
  return left > right ? left : right;
}

// Integer math keeps every nanoton, unlike multiplying a float share
export function multiplyBigIntByPermille(value: bigint, permille: number) {
  return (value * BigInt(Math.round(permille))) / PERMILLE_DIVISOR;
}

export function tryParseBigInt(value: string): bigint | undefined {
  try {
    return BigInt(value);
  } catch (error) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('Error parsing BigInt', value, error);
    }
    return undefined;
  }
}

// `toJSON` exists only during this synchronous call, so any other `JSON.stringify` still fails on `bigint`
export function stringifyJsonWithBigInt(value: unknown) {
  Object.defineProperty(BigInt.prototype, 'toJSON', { value: convertBigIntToJson, configurable: true });

  try {
    return JSON.stringify(value);
  } finally {
    delete (BigInt.prototype as { toJSON?: unknown }).toJSON;
  }
}

// A plain parse followed by one pass over the tree is several times faster than a reviver
export function parseJsonWithBigInt<T>(json: string): T {
  const parsed = JSON.parse(json);
  if (parsed && typeof parsed === 'object') restoreTaggedBigInts(parsed);

  return parsed;
}

function convertBigIntToJson(this: bigint) {
  return { [BIGINT_JSON_KEY]: this.toString() };
}

function restoreTaggedBigInts(root: object) {
  const pending: any[] = [root];

  while (pending.length) {
    const node = pending.pop();

    for (const key of Object.keys(node)) {
      const value = node[key];
      if (!value || typeof value !== 'object') continue;

      const bigint = getTaggedBigInt(value);
      if (bigint === undefined) {
        pending.push(value);
      } else {
        node[key] = bigint;
      }
    }
  }
}

function getTaggedBigInt(value: any) {
  const digits = value[BIGINT_JSON_KEY];

  return typeof digits === 'string' && BIGINT_DIGITS_REGEX.test(digits) && Object.keys(value).length === 1
    ? BigInt(digits)
    : undefined;
}
