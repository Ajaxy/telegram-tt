import { getX25519SharedSecret } from './ed25519';

export const ENCRYPTED_COMMENT_OPCODE = 0x2167da4b;
const PUBLIC_KEY_LENGTH = 32;
const MSG_KEY_LENGTH = 16;
const AES_BLOCK_LENGTH = 16;
const AES_KEY_LENGTH = 32;
const MIN_PREFIX_LENGTH = 16;

// As tonlib's `SimpleEncryptionV2`: the sender's key XOR ours, a 16-byte `msgKey` that is also the HMAC of the
// plaintext, then AES-CBC data whose first byte is the length of a random prefix
export async function decryptMessageComment(
  payload: Uint8Array, ourPublicKey: Uint8Array, seed: Uint8Array, salt: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const theirPublicKey = payload.slice(0, PUBLIC_KEY_LENGTH).map((byte, index) => byte ^ ourPublicKey[index]);
  const msgKey = payload.slice(PUBLIC_KEY_LENGTH, PUBLIC_KEY_LENGTH + MSG_KEY_LENGTH);
  const encrypted = payload.slice(PUBLIC_KEY_LENGTH + MSG_KEY_LENGTH);

  if (!encrypted.length || encrypted.length % AES_BLOCK_LENGTH) {
    throw new Error('Malformed encrypted comment');
  }

  const sharedSecret = await getX25519SharedSecret(seed, theirPublicKey);
  const cbcSecret = await hmacSha512(sharedSecret, msgKey);
  const decrypted = await decryptAesCbcWithoutPadding(
    cbcSecret.slice(0, AES_KEY_LENGTH), cbcSecret.slice(AES_KEY_LENGTH, AES_KEY_LENGTH + AES_BLOCK_LENGTH), encrypted,
  );

  const expectedMsgKey = (await hmacSha512(salt, decrypted)).slice(0, MSG_KEY_LENGTH);

  if (!expectedMsgKey.every((byte, index) => byte === msgKey[index])) {
    throw new Error('Encrypted comment hash mismatch');
  }

  const prefixLength = decrypted[0];

  if (prefixLength < MIN_PREFIX_LENGTH || prefixLength > decrypted.length) {
    throw new Error('Malformed encrypted comment');
  }

  return new TextDecoder().decode(decrypted.subarray(prefixLength));
}

// `salt` is our own bounceable address, which the receiver salts the check with
export async function encryptMessageComment(
  text: string, ourPublicKey: Uint8Array, seed: Uint8Array, theirPublicKey: Uint8Array, salt: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const padded = addRandomPrefix(new TextEncoder().encode(text));
  const msgKey = (await hmacSha512(salt, padded)).slice(0, MSG_KEY_LENGTH);
  const sharedSecret = await getX25519SharedSecret(seed, theirPublicKey);
  const cbcSecret = await hmacSha512(sharedSecret, msgKey);
  const encrypted = await encryptAesCbcWithoutPadding(
    cbcSecret.slice(0, AES_KEY_LENGTH), cbcSecret.slice(AES_KEY_LENGTH, AES_KEY_LENGTH + AES_BLOCK_LENGTH), padded,
  );

  const payload = new Uint8Array(PUBLIC_KEY_LENGTH + MSG_KEY_LENGTH + encrypted.length);
  payload.set(ourPublicKey.map((byte, index) => byte ^ theirPublicKey[index]));
  payload.set(msgKey, PUBLIC_KEY_LENGTH);
  payload.set(encrypted, PUBLIC_KEY_LENGTH + MSG_KEY_LENGTH);

  return payload;
}

export function getEncryptedCommentLength(byteLength: number): number {
  return PUBLIC_KEY_LENGTH + MSG_KEY_LENGTH + getPrefixedLength(byteLength);
}

// 16 to 31 random bytes aligning the plaintext to the AES block; the first byte is the prefix length
export function addRandomPrefix(data: Uint8Array): Uint8Array<ArrayBuffer> {
  const prefixLength = getPrefixedLength(data.length) - data.length;
  const result = new Uint8Array(prefixLength + data.length);
  crypto.getRandomValues(result.subarray(0, prefixLength));
  result[0] = prefixLength;
  result.set(data, prefixLength);

  return result;
}

function getPrefixedLength(byteLength: number): number {
  return (MIN_PREFIX_LENGTH + AES_BLOCK_LENGTH - 1 + byteLength) & ~(AES_BLOCK_LENGTH - 1);
}

export function hmacSha512(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>) {
  return hmacSha('SHA-512', key, data);
}

export function hmacSha256(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>) {
  return hmacSha('SHA-256', key, data);
}

async function hmacSha(
  hash: 'SHA-256' | 'SHA-512', key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const algorithm = { name: 'HMAC', hash };
  const cryptoKey = await crypto.subtle.importKey('raw', key, algorithm, false, ['sign']);

  return new Uint8Array(await crypto.subtle.sign(algorithm, cryptoKey, data));
}

// WebCrypto insists on PKCS#7, so an extra block that decrypts to a full block of padding is appended
export async function decryptAesCbcWithoutPadding(
  key: Uint8Array<ArrayBuffer>, iv: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-CBC', false, ['encrypt', 'decrypt']);
  const lastBlock = data.subarray(data.length - AES_BLOCK_LENGTH);
  const paddingBlock = new Uint8Array(AES_BLOCK_LENGTH).fill(AES_BLOCK_LENGTH);
  const tailBlock = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-CBC', iv: lastBlock }, cryptoKey, paddingBlock),
  ).subarray(0, AES_BLOCK_LENGTH);

  const padded = new Uint8Array(data.length + AES_BLOCK_LENGTH);
  padded.set(data);
  padded.set(tailBlock, data.length);

  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, padded));
}

// WebCrypto appends a full block of PKCS#7 padding, so the output is cut back to the input length
export async function encryptAesCbcWithoutPadding(
  key: Uint8Array<ArrayBuffer>, iv: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, 'AES-CBC', false, ['encrypt']);

  return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, cryptoKey, data)).slice(0, data.length);
}
