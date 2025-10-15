import { createHash, randomBytes } from './crypto/crypto';

export function readBigIntFromBuffer(buffer: Buffer, little = true, signed = false): bigint {
  const len = buffer.length;
  if (len === 0) return 0n;

  // Hot path for longs
  if (len === 8) {
    if (signed) {
      return little ? buffer.readBigInt64LE(0) : buffer.readBigInt64BE(0);
    } else {
      return little ? buffer.readBigUInt64LE(0) : buffer.readBigUInt64BE(0);
    }
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
  const buffer = Buffer.allocUnsafe(number);

  // Use Buffer method for 8-byte buffers
  if (number === 8) {
    buffer.writeBigInt64LE(big);
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
): Buffer<ArrayBuffer> {
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

  const buf = Buffer.allocUnsafe(bytesNumber);
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
  return Buffer.from(randomBytes(count));
}

export function generateRandomBigInt(bytes: number = 8) {
  return readBigIntFromBuffer(generateRandomBytes(bytes), true, true);
}

export function generateRandomInt32() {
  return Number(readBigIntFromBuffer(generateRandomBytes(4), true, true));
}

export async function generateKeyDataFromNonce(
  serverNonceBigInt: bigint, newNonceBigInt: bigint,
) {
  const serverNonce = toSignedLittleBuffer(serverNonceBigInt, 16);
  const newNonce = toSignedLittleBuffer(newNonceBigInt, 32);
  const [hash1, hash2, hash3] = await Promise.all([
    sha1(Buffer.concat([newNonce, serverNonce])),
    sha1(Buffer.concat([serverNonce, newNonce])),
    sha1(Buffer.concat([newNonce, newNonce])),
  ]);
  const keyBuffer = Buffer.concat([hash1, hash2.slice(0, 12)]);
  const ivBuffer = Buffer.concat([hash2.slice(12, 20), hash3, newNonce.slice(0, 4)]);
  return {
    key: keyBuffer,
    iv: ivBuffer,
  };
}

export function convertToLittle(buf: Uint32Array) {
  const correct = Buffer.alloc(buf.length * 4);

  for (let i = 0; i < buf.length; i++) {
    correct.writeUInt32BE(buf[i], i * 4);
  }
  return correct;
}

export function sha1(data: Buffer): Promise<Buffer<ArrayBuffer>> {
  const shaSum = createHash('sha1');
  shaSum.update(data);
  return shaSum.digest();
}

export function sha256(data: Buffer): Promise<Buffer<ArrayBuffer>> {
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

export function getByteArray(integer: bigint, signed = false): Buffer<ArrayBuffer> {
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

export function bufferXor(a: Buffer, b: Buffer) {
  const res = [];
  for (let i = 0; i < a.length; i++) {
    res.push(a[i] ^ b[i]);
  }
  return Buffer.from(res);
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

export function crc32(buf: Buffer | string) {
  if (!Buffer.isBuffer(buf)) {
    buf = Buffer.from(buf);
  }
  let crc = -1;

  for (let index = 0; index < buf.length; index++) {
    const byte = buf[index];
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
