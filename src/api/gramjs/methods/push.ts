import { IGE } from '../../../lib/gramjs/crypto/IGE';

import { base64UrlToBuffer } from '../../../util/encoding/base64';
import { compareBuffersConstantTime, concat, readUint32LE } from '../../../util/encoding/buffer';
import {
  getPushKeyId, parsePushEnvelope, PUSH_BLOCK_LENGTH, PUSH_KEY_ID_LENGTH, PUSH_KEY_LENGTH,
  PUSH_MESSAGE_KEY_LENGTH, readPushKeyId,
} from '../../../util/push';

const JSON_LENGTH_BYTES = 4;
const MIN_PADDING_BYTES = 12;
const MAX_PADDING_BYTES = 1024;
const INCOMING_KEY_OFFSET = 8;

export async function decryptPushNotification({
  payload, key, userId,
}: { payload: string; key: Uint8Array<ArrayBuffer>; userId: string }) {
  if (key.length !== PUSH_KEY_LENGTH || readPushKeyId(payload) !== await getPushKeyId(key)) return undefined;
  const bytes = base64UrlToBuffer(payload);
  const headerLength = PUSH_KEY_ID_LENGTH + PUSH_MESSAGE_KEY_LENGTH;
  const messageKey = bytes.slice(PUSH_KEY_ID_LENGTH, headerLength);
  const offset = INCOMING_KEY_OFFSET;
  const [hashA, hashB] = await Promise.all([
    hashPushBytes(concat(messageKey, key.slice(offset, offset + 36))),
    hashPushBytes(concat(key.slice(offset + 40, offset + 76), messageKey)),
  ]);
  const aesKey = concat(hashA.slice(0, 8), hashB.slice(8, 24), hashA.slice(24, 32));
  const aesIv = concat(hashB.slice(0, 8), hashA.slice(8, 24), hashB.slice(24, 32));
  const ciphertext = bytes.slice(headerLength);
  if (!ciphertext.length || ciphertext.length % PUSH_BLOCK_LENGTH) return undefined;
  const plaintext = new IGE(aesKey, aesIv).decryptIge(ciphertext);
  const expectedKey = (await hashPushBytes(concat(key.slice(88 + offset, 120 + offset), plaintext))).slice(8, 24);
  if (!compareBuffersConstantTime(messageKey, expectedKey)) return undefined;
  const length = readUint32LE(plaintext);
  const padding = plaintext.length - JSON_LENGTH_BYTES - length;
  if (!length || padding < MIN_PADDING_BYTES || padding > MAX_PADDING_BYTES) return undefined;
  try {
    const text = new TextDecoder('utf-8', { fatal: true })
      .decode(plaintext.slice(JSON_LENGTH_BYTES, JSON_LENGTH_BYTES + length));
    const data = parsePushEnvelope(JSON.parse(text));
    return data && !('p' in data) && data.user_id === userId ? data : undefined;
  } catch {
    return undefined;
  }
}

async function hashPushBytes(bytes: Uint8Array<ArrayBuffer>) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}
