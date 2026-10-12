// Ed25519 (RFC 8032) and the X25519 exchange derived from it. Secret-key operations go through WebCrypto,
// which is constant-time; a browser without the curves falls back to a `BigInt` port of noble-ed25519
// (https://github.com/paulmillr/noble-ed25519), whose scalar multiplication is not constant-time.

import { base64UrlToBuffer } from '../../util/encoding/base64';
import { concat } from '../../util/encoding/buffer';

const P = 2n ** 255n - 19n;
const L = 2n ** 252n + 27742317777372353535851937790883648493n;
const D = 37095705934669439343138083508754565189542113879843219016388785533085940283555n;
const BASE_X = 15112221349535400772501151409588531511454012693041857206046113283949847762202n;
const BASE_Y = 46316835694926478169428394003475163141307993866256225615783033603165251855960n;
const A24 = 121665n;
const U_COORDINATE_MASK = 2n ** 255n - 1n;

// Extended homogeneous coordinates on the twisted Edwards curve
type Point = { x: bigint; y: bigint; z: bigint; t: bigint };

const ZERO_POINT: Point = {
  x: 0n, y: 1n, z: 1n, t: 0n,
};

const ED25519_PKCS8_PREFIX = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);
const X25519_PKCS8_PREFIX = Uint8Array.from([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20,
]);

let isNativeEd25519Supported: boolean | undefined;
let isNativeX25519Supported: boolean | undefined;
const X25519_BASE_POINT_U = 9n;

export async function signEd25519(
  message: Uint8Array<ArrayBuffer>, seed: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  if (isNativeEd25519Supported !== false) {
    try {
      const key = await importEd25519PrivateKey(seed, false, ['sign']);
      const signature = new Uint8Array(await crypto.subtle.sign('Ed25519', key, message));
      isNativeEd25519Supported = true;

      return signature;
    } catch {
      isNativeEd25519Supported = false;
    }
  }

  const { scalar, prefix } = await expandSeed(seed);

  const publicKey = pointToBytes(multiplyBase(scalar));
  const r = bytesToNumberLe(await sha512(prefix, message)) % L;
  const rBytes = pointToBytes(multiplyBase(r));
  const k = bytesToNumberLe(await sha512(rBytes, publicKey, message)) % L;
  const s = (r + k * scalar) % L;

  const signature = new Uint8Array(64);
  signature.set(rBytes);
  signature.set(numberToBytesLe(s), 32);

  return signature;
}

export async function getEd25519PublicKey(seed: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  if (isNativeEd25519Supported !== false) {
    try {
      // The JWK of the private key carries the public half in `x`
      const key = await importEd25519PrivateKey(seed, true, ['sign']);
      const jwk = await crypto.subtle.exportKey('jwk', key);
      isNativeEd25519Supported = true;

      return base64UrlToBuffer(jwk.x!);
    } catch {
      isNativeEd25519Supported = false;
    }
  }

  const { scalar } = await expandSeed(seed);

  return pointToBytes(multiplyBase(scalar));
}

// The other key is mapped to its Montgomery u-coordinate and multiplied by our clamped scalar, as TON expects
export async function getX25519SharedSecret(
  seed: Uint8Array, theirPublicKey: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const { scalar, scalarBytes } = await expandSeed(seed);
  const y = bytesToNumberLe(theirPublicKey) & U_COORDINATE_MASK;
  const u = mod((1n + y) * modPow(mod(1n - y), P - 2n));

  if (await checkNativeX25519()) {
    try {
      return await deriveX25519Native(scalarBytes, numberToBytesLe(u));
    } catch {
      // WebCrypto refuses a small-order key, which is the sender's fault, not the platform's
      throw new Error('Invalid public key');
    }
  }

  const shared = multiplyMontgomery(scalar, u);

  // A small-order key yields an all-zero secret, which native WebCrypto rejects; the fallback matches it
  if (!shared) {
    throw new Error('Invalid public key');
  }

  return numberToBytesLe(shared);
}

async function deriveX25519Native(
  scalarBytes: Uint8Array<ArrayBuffer>, theirU: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const privateKey = await crypto.subtle.importKey(
    'pkcs8', wrapPkcs8(X25519_PKCS8_PREFIX, scalarBytes), 'X25519', false, ['deriveBits'],
  );
  const publicKey = await crypto.subtle.importKey('raw', theirU, 'X25519', false, []);

  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'X25519', public: publicKey }, privateKey, 256));
}

// Checked once on fixed keys: a failure on a caller's key must not demote later exchanges to the fallback
async function checkNativeX25519(): Promise<boolean> {
  if (isNativeX25519Supported === undefined) {
    try {
      await deriveX25519Native(new Uint8Array(32).fill(1), numberToBytesLe(X25519_BASE_POINT_U));
      isNativeX25519Supported = true;
    } catch {
      isNativeX25519Supported = false;
    }
  }

  return isNativeX25519Supported;
}

async function expandSeed(seed: Uint8Array) {
  const hash = await sha512(seed);

  const scalarBytes = hash.slice(0, 32);
  scalarBytes[0] &= 248;
  scalarBytes[31] &= 127;
  scalarBytes[31] |= 64;

  return {
    scalar: bytesToNumberLe(scalarBytes),
    scalarBytes,
    prefix: hash.subarray(32),
  };
}

function importEd25519PrivateKey(seed: Uint8Array, isExtractable: boolean, usages: KeyUsage[]) {
  return crypto.subtle.importKey('pkcs8', wrapPkcs8(ED25519_PKCS8_PREFIX, seed), 'Ed25519', isExtractable, usages);
}

function wrapPkcs8(prefix: Uint8Array, key: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(prefix.length + key.length);
  bytes.set(prefix);
  bytes.set(key, prefix.length);

  return bytes;
}

function mod(value: bigint): bigint {
  const result = value % P;

  return result >= 0n ? result : result + P;
}

// The unified addition formula (add-2008-hwcd-3) is complete for `a = -1`, so it covers doubling too
function addPoints(a: Point, b: Point): Point {
  const subProduct = mod((a.y - a.x) * (b.y - b.x));
  const addProduct = mod((a.y + a.x) * (b.y + b.x));
  const tProduct = mod(2n * D * a.t * b.t);
  const zProduct = mod(2n * a.z * b.z);
  const e = addProduct - subProduct;
  const f = zProduct - tProduct;
  const g = zProduct + tProduct;
  const h = addProduct + subProduct;

  return {
    x: mod(e * f), y: mod(g * h), t: mod(e * h), z: mod(f * g),
  };
}

function multiplyBase(scalar: bigint): Point {
  let result = ZERO_POINT;
  let addend: Point = {
    x: BASE_X, y: BASE_Y, z: 1n, t: mod(BASE_X * BASE_Y),
  };

  let rest = scalar;

  while (rest > 0n) {
    if (rest & 1n) {
      result = addPoints(result, addend);
    }

    addend = addPoints(addend, addend);
    rest >>= 1n;
  }

  return result;
}

// The RFC 7748 ladder over the u-coordinate alone
function multiplyMontgomery(scalar: bigint, u: bigint): bigint {
  let x2 = 1n;
  let z2 = 0n;
  let x3 = u;
  let z3 = 1n;
  let swap = 0n;

  for (let bit = 254n; bit >= 0n; bit--) {
    const k = (scalar >> bit) & 1n;
    swap ^= k;
    [x2, x3, z2, z3] = swap ? [x3, x2, z3, z2] : [x2, x3, z2, z3];
    swap = k;

    const a = mod(x2 + z2);
    const aa = mod(a * a);
    const b = mod(x2 - z2);
    const bb = mod(b * b);
    const e = mod(aa - bb);
    const c = mod(x3 + z3);
    const d = mod(x3 - z3);
    const da = mod(d * a);
    const cb = mod(c * b);
    x3 = mod((da + cb) ** 2n);
    z3 = mod(u * (da - cb) ** 2n);
    x2 = mod(aa * bb);
    z2 = mod(e * (aa + A24 * e));
  }

  [x2, z2] = swap ? [x3, z3] : [x2, z2];

  return mod(x2 * modPow(z2, P - 2n));
}

function pointToBytes(point: Point): Uint8Array<ArrayBuffer> {
  const zInverse = modPow(point.z, P - 2n);
  const x = mod(point.x * zInverse);
  const y = mod(point.y * zInverse);

  const bytes = numberToBytesLe(y);
  bytes[31] |= Number(x & 1n) << 7;

  return bytes;
}

function modPow(base: bigint, exponent: bigint): bigint {
  let result = 1n;
  let b = base;
  let e = exponent;

  while (e > 0n) {
    if (e & 1n) {
      result = mod(result * b);
    }

    b = mod(b * b);
    e >>= 1n;
  }

  return result;
}

function bytesToNumberLe(bytes: Uint8Array): bigint {
  let result = 0n;

  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i]);
  }

  return result;
}

function numberToBytesLe(value: bigint): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(32);
  let rest = value;

  for (let i = 0; i < 32; i++) {
    bytes[i] = Number(rest & 0xffn);
    rest >>= 8n;
  }

  return bytes;
}

async function sha512(...chunks: Uint8Array[]): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-512', concat(...chunks)));
}
