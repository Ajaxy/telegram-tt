import { pbkdf2 } from './crypto/crypto';
import Api from './tl/api';

import {
  bigIntMod,
  bitLength,
  generateRandomBytes,
  modExp,
  readBigIntFromBuffer,
  readBufferFromBigInt,
  sha256,
} from './Helpers';

const SIZE_FOR_HASH = 256;

function checkPrimeAndGood(primeBytes: Buffer, g: number) {
  const goodPrime = Buffer.from([
    0xC7, 0x1C, 0xAE, 0xB9, 0xC6, 0xB1, 0xC9, 0x04, 0x8E, 0x6C, 0x52, 0x2F, 0x70, 0xF1, 0x3F, 0x73,
    0x98, 0x0D, 0x40, 0x23, 0x8E, 0x3E, 0x21, 0xC1, 0x49, 0x34, 0xD0, 0x37, 0x56, 0x3D, 0x93, 0x0F,
    0x48, 0x19, 0x8A, 0x0A, 0xA7, 0xC1, 0x40, 0x58, 0x22, 0x94, 0x93, 0xD2, 0x25, 0x30, 0xF4, 0xDB,
    0xFA, 0x33, 0x6F, 0x6E, 0x0A, 0xC9, 0x25, 0x13, 0x95, 0x43, 0xAE, 0xD4, 0x4C, 0xCE, 0x7C, 0x37,
    0x20, 0xFD, 0x51, 0xF6, 0x94, 0x58, 0x70, 0x5A, 0xC6, 0x8C, 0xD4, 0xFE, 0x6B, 0x6B, 0x13, 0xAB,
    0xDC, 0x97, 0x46, 0x51, 0x29, 0x69, 0x32, 0x84, 0x54, 0xF1, 0x8F, 0xAF, 0x8C, 0x59, 0x5F, 0x64,
    0x24, 0x77, 0xFE, 0x96, 0xBB, 0x2A, 0x94, 0x1D, 0x5B, 0xCD, 0x1D, 0x4A, 0xC8, 0xCC, 0x49, 0x88,
    0x07, 0x08, 0xFA, 0x9B, 0x37, 0x8E, 0x3C, 0x4F, 0x3A, 0x90, 0x60, 0xBE, 0xE6, 0x7C, 0xF9, 0xA4,
    0xA4, 0xA6, 0x95, 0x81, 0x10, 0x51, 0x90, 0x7E, 0x16, 0x27, 0x53, 0xB5, 0x6B, 0x0F, 0x6B, 0x41,
    0x0D, 0xBA, 0x74, 0xD8, 0xA8, 0x4B, 0x2A, 0x14, 0xB3, 0x14, 0x4E, 0x0E, 0xF1, 0x28, 0x47, 0x54,
    0xFD, 0x17, 0xED, 0x95, 0x0D, 0x59, 0x65, 0xB4, 0xB9, 0xDD, 0x46, 0x58, 0x2D, 0xB1, 0x17, 0x8D,
    0x16, 0x9C, 0x6B, 0xC4, 0x65, 0xB0, 0xD6, 0xFF, 0x9C, 0xA3, 0x92, 0x8F, 0xEF, 0x5B, 0x9A, 0xE4,
    0xE4, 0x18, 0xFC, 0x15, 0xE8, 0x3E, 0xBE, 0xA0, 0xF8, 0x7F, 0xA9, 0xFF, 0x5E, 0xED, 0x70, 0x05,
    0x0D, 0xED, 0x28, 0x49, 0xF4, 0x7B, 0xF9, 0x59, 0xD9, 0x56, 0x85, 0x0C, 0xE9, 0x29, 0x85, 0x1F,
    0x0D, 0x81, 0x15, 0xF6, 0x35, 0xB1, 0x05, 0xEE, 0x2E, 0x4E, 0x15, 0xD0, 0x4B, 0x24, 0x54, 0xBF,
    0x6F, 0x4F, 0xAD, 0xF0, 0x34, 0xB1, 0x04, 0x03, 0x11, 0x9C, 0xD8, 0xE3, 0xB9, 0x2F, 0xCC, 0x5B,
  ]);
  if (goodPrime.equals(primeBytes)) {
    if ([3, 4, 5, 7].includes(g)) {
      return; // It's good
    }
  }
  throw new Error('Changing passwords unsupported');
  // checkPrimeAndGoodCheck(readBigIntFromBuffer(primeBytes, false), g)
}

function isGoodLarge(number: bigint, p: bigint): boolean {
  return number > 0n && number < p;
}

function numBytesForHash(number: Buffer): Buffer<ArrayBuffer> {
  return Buffer.concat([Buffer.alloc(SIZE_FOR_HASH - number.length), number]);
}

function bigNumForHash(g: bigint) {
  return readBufferFromBigInt(g, SIZE_FOR_HASH, false);
}

function isGoodModExpFirst(modexp: bigint, prime: bigint): boolean {
  const diff = prime - modexp;

  const minDiffBitsCount = 2048 - 64;
  const maxModExpSize = 256;

  return !(
    diff < 0n
    || bitLength(diff) < minDiffBitsCount
    || bitLength(modexp) < minDiffBitsCount
    || Math.floor((bitLength(modexp) + 7) / 8) > maxModExpSize
  );
}

function xor(a: Buffer, b: Buffer) {
  const length = Math.min(a.length, b.length);

  for (let i = 0; i < length; i++) {
    a[i] ^= b[i];
  }

  return a;
}

function pbkdf2sha512(password: Buffer<ArrayBuffer>, salt: Buffer<ArrayBuffer>, iterations: number): any {
  return pbkdf2(password, salt, iterations);
}

/**
 *
 * @param algo {constructors.PasswordKdfAlgoSHA256SHA256PBKDF2HMACSHA512iter100000SHA256ModPow}
 * @param password
 * @returns {Buffer|*}
 */
async function computeHash(
  algo: Api.PasswordKdfAlgoSHA256SHA256PBKDF2HMACSHA512iter100000SHA256ModPow, password: string,
) {
  const hash1 = await sha256(Buffer.concat([algo.salt1, Buffer.from(password, 'utf-8'), algo.salt1]));
  const hash2 = await sha256(Buffer.concat([algo.salt2, hash1, algo.salt2]));
  const hash3 = await pbkdf2sha512(hash2, algo.salt1 as Buffer<ArrayBuffer>, 100000);
  return sha256(Buffer.concat([algo.salt2, hash3, algo.salt2]));
}

export async function computeDigest(
  algo: Api.PasswordKdfAlgoSHA256SHA256PBKDF2HMACSHA512iter100000SHA256ModPow, password: string,
) {
  try {
    checkPrimeAndGood(algo.p, algo.g);
  } catch (e) {
    throw new Error('bad p/g in password');
  }

  const value = modExp(BigInt(algo.g),
    readBigIntFromBuffer(await computeHash(algo, password), false),
    readBigIntFromBuffer(algo.p, false));
  return bigNumForHash(value);
}

/**
 *
 * @param request {constructors.account.Password}
 * @param password {string}
 */
export async function computeCheck(request: Api.account.Password, password: string) {
  const algo = request.currentAlgo;
  if (!(algo instanceof Api.PasswordKdfAlgoSHA256SHA256PBKDF2HMACSHA512iter100000SHA256ModPow)) {
    throw new Error(`Unsupported password algorithm ${algo?.className}`);
  }

  const srpB = request.srp_B;
  const srpId = request.srpId;
  if (!srpB || !srpId) {
    throw new Error(`Undefined srp_b  ${request.className}`);
  }
  const pwHash = await computeHash(algo, password);
  const p = readBigIntFromBuffer(algo.p, false);
  const { g } = algo;
  const B = readBigIntFromBuffer(srpB, false);
  try {
    checkPrimeAndGood(algo.p, g);
  } catch (e) {
    throw new Error('bad p/g in password');
  }
  if (!isGoodLarge(B, p)) {
    throw new Error('bad b in check');
  }
  const x = readBigIntFromBuffer(pwHash, false);
  const pForHash = numBytesForHash(algo.p);
  const gForHash = bigNumForHash(BigInt(g));
  const bForHash = numBytesForHash(srpB);
  const gX = modExp(BigInt(g), x, p);
  const k = readBigIntFromBuffer(await sha256(Buffer.concat([pForHash, gForHash])), false);
  const kgX = bigIntMod(k * gX, p);
  const generateAndCheckRandom = async () => {
    const randomSize = 256;

    while (true) {
      const random = generateRandomBytes(randomSize);
      const a = readBigIntFromBuffer(random, false);
      const A = modExp(BigInt(g), a, p);
      if (isGoodModExpFirst(A, p)) {
        const aForHash = bigNumForHash(A);
        const u = readBigIntFromBuffer(await sha256(Buffer.concat([aForHash, bForHash])), false);
        if (u > 0n) {
          return { a, aForHash, u };
        }
      }
    }
  };
  const { a, aForHash, u } = await generateAndCheckRandom();
  const gB = bigIntMod(B - kgX, p);
  if (!isGoodModExpFirst(gB, p)) {
    throw new Error('bad gB');
  }

  const ux = u * x;
  const aUx = a + ux;
  const S = modExp(gB, aUx, p);
  const [K, pSha, gSha, salt1Sha, salt2Sha] = await Promise.all([
    sha256(bigNumForHash(S)),
    sha256(pForHash),
    sha256(gForHash),
    sha256(algo.salt1),
    sha256(algo.salt2),
  ]);
  const M1 = await sha256(Buffer.concat([
    xor(pSha, gSha),
    salt1Sha,
    salt2Sha,
    aForHash,
    bForHash,
    K,
  ]));

  return new Api.InputCheckPasswordSRP({
    srpId,
    A: aForHash,
    M1,
  });
}
