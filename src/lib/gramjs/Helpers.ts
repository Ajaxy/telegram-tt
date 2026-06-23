import {
  bufferFromHex,
  bufferFromUtf8,
  buffersEqual,
  concat,
  readBigUint64BE,
  readBigUint64LE,
  writeBigInt64LE,
} from '../../util/encoding/buffer';
import { createHash, randomBytes } from './crypto/crypto';
import { SecurityError } from './errors';

const BIG_UINT_64_SIGN = 0x8000000000000000n;
const BIG_UINT_64_SIZE = 0x10000000000000000n;
export const DH_PRIME_BYTES = 256;

const DH_PRIME_BITS = 2048;
const DH_PUBLIC_VALUE_SECURITY_BITS = 64;
const DH_PUBLIC_VALUE_THRESHOLD = 1n << BigInt(DH_PRIME_BITS - DH_PUBLIC_VALUE_SECURITY_BITS);
const MAX_DH_PRIVATE_EXPONENT_ATTEMPTS = 128;
const GOOD_DH_PRIME = bufferFromHex(
  'c71caeb9c6b1c9048e6c522f70f13f73980d40238e3e21c14934d037563d930f'
  + '48198a0aa7c14058229493d22530f4dbfa336f6e0ac925139543aed44cce7c37'
  + '20fd51f69458705ac68cd4fe6b6b13abdc9746512969328454f18faf8c595f64'
  + '2477fe96bb2a941d5bcd1d4ac8cc49880708fa9b378e3c4f3a9060bee67cf9a'
  + '4a4a695811051907e162753b56b0f6b410dba74d8a84b2a14b3144e0ef1284754'
  + 'fd17ed950d5965b4b9dd46582db1178d169c6bc465b0d6ff9ca3928fef5b9ae'
  + '4e418fc15e83ebea0f87fa9ff5eed70050ded2849f47bf959d956850ce929851'
  + 'f0d8115f635b105ee2e4e15d04b2454bf6f4fadf034b10403119cd8e3b92fcc5b',
);

export function readBigIntFromBuffer(buffer: Uint8Array, little = true, signed = false): bigint {
  const len = buffer.length;
  if (len === 0) return 0n;

  // Hot path for longs
  if (len === 8) {
    const value = little ? readBigUint64LE(buffer) : readBigUint64BE(buffer);
    return signed && value >= BIG_UINT_64_SIGN ? value - BIG_UINT_64_SIZE : value;
  }

  // Parse unsigned value
  let x = 0n;
  if (little) {
    for (let i = len - 1; i >= 0; i--) x = (x << 8n) | BigInt(buffer[i]);
  } else {
    for (let i = 0; i < len; i++) x = (x << 8n) | BigInt(buffer[i]);
  }

  // Apply two's-complement decode if signed and sign bit is set
  if (signed) {
    const signBit = 1n << BigInt(len * 8 - 1);
    if ((x & signBit) !== 0n) x -= 1n << BigInt(len * 8);
  }
  return x;
}

export function toSignedLittleBuffer(big: bigint, number = 8) {
  const buffer = new Uint8Array(number);

  // Use long hot path for 8-byte buffers
  if (number === 8) {
    writeBigInt64LE(buffer, big);
    return buffer;
  }

  // For other sizes, extract bytes manually
  for (let i = 0; i < number; i++) {
    buffer[i] = Number((big >> BigInt(8 * i)) & 0xFFn);
  }

  return buffer;
}

export function readBufferFromBigInt(
  value: bigint,
  bytesNumber: number,
  little = true,
  signed = false,
): Uint8Array<ArrayBuffer> {
  if (!Number.isInteger(bytesNumber) || bytesNumber <= 0) {
    throw new RangeError('bytesNumber must be a positive integer');
  }
  if (!signed && value < 0n) {
    throw new RangeError('Cannot convert negative to unsigned');
  }

  const bits = 8n * BigInt(bytesNumber);
  const min = signed ? -(1n << (bits - 1n)) : 0n;
  const max = signed ? (1n << (bits - 1n)) - 1n : (1n << bits) - 1n;

  if (value < min || value > max) {
    throw new RangeError(
      `Value ${value} does not fit in ${bytesNumber} ${signed ? 'signed' : 'unsigned'} bytes`,
    );
  }

  // Two's complement encode if negative
  let v = signed && value < 0n ? (1n << bits) + value : value;

  const buf = new Uint8Array(bytesNumber);
  if (little) {
    for (let i = 0; i < bytesNumber; i++) {
      buf[i] = Number(v & 0xFFn);
      v >>= 8n;
    }
  } else {
    for (let i = bytesNumber - 1; i >= 0; i--) {
      buf[i] = Number(v & 0xFFn);
      v >>= 8n;
    }
  }
  return buf;
}

export function generateRandomLong(signed = true) {
  return readBigIntFromBuffer(generateRandomBytes(8), true, signed);
}

export function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

export function bigIntMod(n: bigint, m: bigint) {
  return ((n % m) + m) % m;
}

export function generateRandomBytes(count: number) {
  return randomBytes(count);
}

export function generateRandomBigInt(bytes: number = 8) {
  return readBigIntFromBuffer(generateRandomBytes(bytes), true, true);
}

export function generateRandomInt32() {
  return Number(readBigIntFromBuffer(generateRandomBytes(4), true, true));
}

export function validateDhParameters(primeBytes: Uint8Array, generator: number) {
  const prime = readBigIntFromBuffer(primeBytes, false);
  if (!buffersEqual(primeBytes, GOOD_DH_PRIME) || !isDhGeneratorGood(prime, generator)) {
    throw new SecurityError('Invalid DH prime or generator');
  }

  return prime;
}

export function generateDhPrivateExponent(prime: bigint, serverRandom?: Uint8Array | number[]) {
  const serverRandomBytes = serverRandom ? Uint8Array.from(serverRandom) : undefined;

  for (let attempt = 0; attempt < MAX_DH_PRIVATE_EXPONENT_ATTEMPTS; attempt++) {
    const privateExponentBytes = generateRandomBytes(DH_PRIME_BYTES);
    if (serverRandomBytes) {
      const mixedLength = Math.min(privateExponentBytes.length, serverRandomBytes.length);
      for (let i = 0; i < mixedLength; i++) {
        privateExponentBytes[i] ^= serverRandomBytes[i];
      }
    }

    const random = readBigIntFromBuffer(privateExponentBytes, false);
    if (random > 1n && random < prime - 1n) {
      return random;
    }
  }

  throw new SecurityError('Failed to generate DH private exponent');
}

export function validateDhPublicValue(value: bigint, prime: bigint, name: string) {
  if (value <= 1n) {
    throw new SecurityError(`DH ${name} must be greater than 1`);
  }

  if (value >= prime - 1n) {
    throw new SecurityError(`DH ${name} must be less than p - 1`);
  }

  if (value <= DH_PUBLIC_VALUE_THRESHOLD || value >= prime - DH_PUBLIC_VALUE_THRESHOLD) {
    throw new SecurityError(`DH ${name} is outside the safe range`);
  }
}

function isDhGeneratorGood(prime: bigint, generator: number) {
  switch (generator) {
    case 2: {
      return prime % 8n === 7n;
    }
    case 3: {
      return prime % 3n === 2n;
    }
    case 4: {
      return true;
    }
    case 5: {
      const remainder = prime % 5n;
      return remainder === 1n || remainder === 4n;
    }
    case 6: {
      const remainder = prime % 24n;
      return remainder === 19n || remainder === 23n;
    }
    case 7: {
      const remainder = prime % 7n;
      return remainder === 3n || remainder === 5n || remainder === 6n;
    }
    default: {
      return false;
    }
  }
}

export async function generateKeyDataFromNonce(
  serverNonceBigInt: bigint, newNonceBigInt: bigint,
) {
  const serverNonce = toSignedLittleBuffer(serverNonceBigInt, 16);
  const newNonce = toSignedLittleBuffer(newNonceBigInt, 32);
  const [hash1, hash2, hash3] = await Promise.all([
    sha1(concat(newNonce, serverNonce)),
    sha1(concat(serverNonce, newNonce)),
    sha1(concat(newNonce, newNonce)),
  ]);
  const keyBuffer = concat(hash1, hash2.slice(0, 12));
  const ivBuffer = concat(hash2.slice(12, 20), hash3, newNonce.slice(0, 4));
  return {
    key: keyBuffer,
    iv: ivBuffer,
  };
}

export function convertToLittle(buf: Uint32Array) {
  const correct = new Uint8Array(buf.length * 4);
  const view = new DataView(correct.buffer);

  for (let i = 0; i < buf.length; i++) {
    view.setUint32(i * 4, buf[i], false);
  }
  return correct;
}

export function sha1(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const shaSum = createHash('sha1');
  shaSum.update(data);
  return shaSum.digest();
}

export function sha256(data: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const shaSum = createHash('sha256');
  shaSum.update(data);
  return shaSum.digest();
}

export function modExp(
  a: bigint,
  b: bigint,
  n: bigint,
) {
  a = a % n;
  let result = 1n;
  let x = a;
  while (b > 0n) {
    const leastSignificantBit = b % 2n;
    b = b / 2n;
    if (leastSignificantBit === 1n) {
      result = result * x;
      result = result % n;
    }
    x = x * x;
    x = x % n;
  }
  return result;
}

export function getByteArray(integer: bigint, signed = false) {
  if (!signed && integer < 0n) {
    throw new RangeError('Cannot convert negative to unsigned');
  }

  let bytes: number;
  if (signed) {
    if (integer >= 0n) {
      const bits = bitLength(integer) + 1;
      bytes = Math.max(1, Math.ceil(bits / 8));
    } else {
      const bits = bitLength(-integer - 1n) + 1;
      bytes = Math.max(1, Math.ceil(bits / 8));
    }
  } else {
    const bits = bitLength(integer);
    bytes = Math.max(1, Math.ceil(bits / 8));
  }

  return readBufferFromBigInt(integer, bytes, false, signed);
}

export function randomBits(k: number): bigint {
  if (k <= 0) return 0n;

  const bytes = randomBytes(Math.ceil(k / 8));

  let r = 0n;
  for (let i = 0; i < bytes.length; i++) {
    r = (r << 8n) | BigInt(bytes[i]);
  }

  return r & ((1n << BigInt(k)) - 1n);
}

export function randBetweenBigInt(a: bigint, b: bigint): bigint {
  const low = a < b ? a : b;
  const high = a < b ? b : a;
  const range = high - low + 1n;

  if (range <= 1n) return low;

  const k = bitLength(range - 1n);
  const twoPowK = 1n << BigInt(k);
  const limit = (twoPowK / range) * range;

  for (;;) {
    const r = randomBits(k);
    if (r < limit) return low + (r % range);
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function bufferXor(a: Uint8Array, b: Uint8Array) {
  const res = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    res[i] = a[i] ^ b[i];
  }
  return res;
}

// Taken from https://stackoverflow.com/questions/18638900/javascript-crc32/18639999#18639999
export const CRC32_TABLE = (() => {
  let c;
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    crcTable[n] = c;
  }
  return crcTable;
})();

export function crc32(buf: Uint8Array | string) {
  const bytes = typeof buf === 'string' ? bufferFromUtf8(buf) : buf;
  let crc = -1;

  for (let index = 0; index < bytes.length; index++) {
    const byte = bytes[index];
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ (-1)) >>> 0;
}

const testersCoeff: number[] = [];
const testersBigCoeff: bigint[] = [];
const testers: bigint[] = [];
let testersN = 0;

// https://stackoverflow.com/a/76616288
export function bitLength(x: bigint) {
  let k = 0;
  while (true) {
    if (testersN === k) {
      testersCoeff.push(32 << testersN);
      testersBigCoeff.push(BigInt(testersCoeff[testersN]));
      testers.push(1n << testersBigCoeff[testersN]);
      testersN++;
    }
    if (x < testers[k]) break;
    k++;
  }

  if (!k) return 32 - Math.clz32(Number(x));

  // determine length by bisection
  k--;
  let i = testersCoeff[k];
  let a = x >> testersBigCoeff[k];
  while (k--) {
    const b = a >> testersBigCoeff[k];
    if (b) {
      i += testersCoeff[k];
      a = b;
    }
  }

  return i + 32 - Math.clz32(Number(a));
}

export const BigMath = {
  abs(x: bigint) {
    return x < 0n ? -x : x;
  },
  sign(x: bigint) {
    if (x === 0n) return 0n;
    return x < 0n ? -1n : 1n;
  },
  pow(base: bigint, exponent: bigint) {
    return base ** exponent;
  },
  min(value: bigint, ...values: bigint[]) {
    for (const v of values) {
      if (v < value) value = v;
    }
    return value;
  },
  max(value: bigint, ...values: bigint[]) {
    for (const v of values) {
      if (v > value) value = v;
    }
    return value;
  },
};

export function jsonStringifyWithBigInt(obj: any) {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  });
}
