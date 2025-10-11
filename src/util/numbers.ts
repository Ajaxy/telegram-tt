import { DEBUG } from '../config';

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
