import { getEd25519PublicKey, getX25519SharedSecret } from './ed25519';
import {
  addRandomPrefix, decryptAesCbcWithoutPadding, encryptAesCbcWithoutPadding, hmacSha256, hmacSha512,
} from './encryption';

const SHARED_SECRET_TAG = 'tde2e_shared_secret';
const ENCRYPT_DATA_TAG = 'tde2e_encrypt_data';
const PUBLIC_KEY_LENGTH = 32;
const SEED_LENGTH = 32;
const MSG_ID_LENGTH = 16;
const AES_KEY_LENGTH = 32;
const AES_BLOCK_LENGTH = 16;
const MIN_PREFIX_LENGTH = 16;
const EXTRA_LENGTH_BYTES = 4;

const textEncoder = new TextEncoder();

export function generateE2eSeed(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(SEED_LENGTH));
}

// As tde2e's `encrypt_message_for_one`: the one-time public key behind `ourSeed` leads the blob
export async function encryptE2eBlob(
  data: Uint8Array<ArrayBuffer>, theirPublicKey: Uint8Array, ourSeed: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const secret = await getE2eSharedSecret(ourSeed, theirPublicKey);
  const encrypted = await encryptE2eData(data, secret);

  const blob = new Uint8Array(PUBLIC_KEY_LENGTH + encrypted.length);
  blob.set(await getEd25519PublicKey(ourSeed));
  blob.set(encrypted, PUBLIC_KEY_LENGTH);

  return blob;
}

export async function decryptE2eBlob(blob: Uint8Array, ourSeed: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  if (blob.length <= PUBLIC_KEY_LENGTH) {
    throw new Error('Malformed e2e blob');
  }

  const secret = await getE2eSharedSecret(ourSeed, blob.slice(0, PUBLIC_KEY_LENGTH));

  return decryptE2eData(blob.slice(PUBLIC_KEY_LENGTH), secret);
}

// `msgId` (a 16-byte HMAC of the padded plaintext), then AES-256-CBC data keyed from the secret and `msgId`
async function encryptE2eData(
  data: Uint8Array<ArrayBuffer>, secret: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  const { encryptSecret, hmacSecret } = await expandSecret(secret);
  const padded = addRandomPrefix(data);
  const msgId = (await hmacSha256(hmacSecret, appendExtraLength(padded))).slice(0, MSG_ID_LENGTH);
  const cbcSecret = await hmacSha512(encryptSecret, msgId);
  const encrypted = await encryptAesCbcWithoutPadding(
    cbcSecret.slice(0, AES_KEY_LENGTH), cbcSecret.slice(AES_KEY_LENGTH, AES_KEY_LENGTH + AES_BLOCK_LENGTH), padded,
  );

  const result = new Uint8Array(MSG_ID_LENGTH + encrypted.length);
  result.set(msgId);
  result.set(encrypted, MSG_ID_LENGTH);

  return result;
}

async function decryptE2eData(
  encrypted: Uint8Array<ArrayBuffer>, secret: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  if (encrypted.length < MSG_ID_LENGTH + AES_BLOCK_LENGTH || (encrypted.length - MSG_ID_LENGTH) % AES_BLOCK_LENGTH) {
    throw new Error('Malformed e2e data');
  }

  const { encryptSecret, hmacSecret } = await expandSecret(secret);
  const msgId = encrypted.slice(0, MSG_ID_LENGTH);
  const cbcSecret = await hmacSha512(encryptSecret, msgId);
  const decrypted = await decryptAesCbcWithoutPadding(
    cbcSecret.slice(0, AES_KEY_LENGTH), cbcSecret.slice(AES_KEY_LENGTH, AES_KEY_LENGTH + AES_BLOCK_LENGTH),
    encrypted.slice(MSG_ID_LENGTH),
  );

  const expectedMsgId = (await hmacSha256(hmacSecret, appendExtraLength(decrypted))).slice(0, MSG_ID_LENGTH);

  if (!expectedMsgId.every((byte, index) => byte === msgId[index])) {
    throw new Error('E2e data hash mismatch');
  }

  const prefixLength = decrypted[0];

  if (prefixLength < MIN_PREFIX_LENGTH || prefixLength > decrypted.length) {
    throw new Error('Malformed e2e data');
  }

  return decrypted.slice(prefixLength);
}

// As tde2e's `key_from_ecdh`
async function getE2eSharedSecret(
  ourSeed: Uint8Array, theirPublicKey: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const x25519 = await getX25519SharedSecret(ourSeed, theirPublicKey);

  return (await hmacSha512(textEncoder.encode(SHARED_SECRET_TAG), x25519)).slice(0, AES_KEY_LENGTH);
}

async function expandSecret(secret: Uint8Array<ArrayBuffer>) {
  const expanded = await hmacSha512(secret, textEncoder.encode(ENCRYPT_DATA_TAG));

  return {
    encryptSecret: expanded.slice(0, AES_KEY_LENGTH),
    hmacSecret: expanded.slice(AES_KEY_LENGTH, AES_KEY_LENGTH * 2),
  };
}

// `msgId` covers the plaintext plus a zero `int32`: the length of additional data, which is never sent
function appendExtraLength(data: Uint8Array): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(data.length + EXTRA_LENGTH_BYTES);
  result.set(data);

  return result;
}
