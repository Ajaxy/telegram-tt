import { LEGACY_PASSCODE_CACHE_NAME } from '../config';
import { PASSCODE_IDB_STORE } from './browser/idb';
import * as cacheApi from './cacheApi';

const IV_LENGTH = 12;
const SALT = 'harder better faster stronger';

let currentPasscodeHash: ArrayBuffer | undefined;

export class UnrecoverablePasscodeError extends Error {}

export function getPasscodeHash() {
  return currentPasscodeHash;
}

export function setPasscodeHash(passcodeHash: ArrayBuffer) {
  currentPasscodeHash = passcodeHash;
}

export async function setupPasscode(passcode: string) {
  currentPasscodeHash = await sha256(passcode);
}

export async function encryptSession(sessionJson?: string, globalJson?: string) {
  if (!currentPasscodeHash) {
    // eslint-disable-next-line no-console
    console.error('[api/passcode] Missing current passcode');
    throw new Error('[api/passcode] Missing current passcode');
  }

  await Promise.all([
    (async () => {
      if (!sessionJson) return;

      const sessionEncrypted = await aesEncrypt(sessionJson, currentPasscodeHash);
      await store('sessionEncrypted', sessionEncrypted);
    })(),
    (async () => {
      if (!globalJson) return;

      const globalEncrypted = await aesEncrypt(globalJson, currentPasscodeHash);
      await store('globalEncrypted', globalEncrypted);
    })(),
  ]);
}

export async function decryptSessionByCurrentHash() {
  if (!currentPasscodeHash) {
    // eslint-disable-next-line no-console
    console.error('[api/passcode] Missing current passcode');
    throw new Error('[api/passcode] Missing current passcode');
  }

  const [sessionEncrypted, globalEncrypted] = await Promise.all([
    load('sessionEncrypted'),
    load('globalEncrypted'),
  ]);

  if (!sessionEncrypted || !globalEncrypted) {
    // eslint-disable-next-line no-console
    console.error('[api/passcode] Missing required stored fields');
    throw new Error('[api/passcode] Missing required stored fields');
  }

  try {
    const [sessionJson, globalJson] = await Promise.all([
      aesDecrypt(sessionEncrypted, currentPasscodeHash),
      aesDecrypt(globalEncrypted, currentPasscodeHash),
    ]);

    return { sessionJson, globalJson };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/passcode] Error decrypting session', err);
    throw err;
  }
}

export async function decryptSession(passcode: string) {
  const passcodeHash = await sha256(passcode);

  const [sessionEncrypted, globalEncrypted] = await Promise.all([
    load('sessionEncrypted'),
    load('globalEncrypted'),
  ]);

  if (!sessionEncrypted || !globalEncrypted) {
    // eslint-disable-next-line no-console
    console.error('[api/passcode] Missing required stored fields');
    throw new UnrecoverablePasscodeError('[api/passcode] Missing required stored fields');
  }

  try {
    const [sessionJson, globalJson] = await Promise.all([
      aesDecrypt(sessionEncrypted, passcodeHash),
      aesDecrypt(globalEncrypted, passcodeHash),
    ]);

    currentPasscodeHash = passcodeHash;

    return { sessionJson, globalJson };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[api/passcode] Error decrypting session', err);
    throw err;
  }
}

export function forgetPasscode() {
  currentPasscodeHash = undefined;
}

export function clearEncryptedSession() {
  forgetPasscode();
  PASSCODE_IDB_STORE.clear();
  return cacheApi.clear(LEGACY_PASSCODE_CACHE_NAME);
}

function sha256(plaintext: string) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${plaintext}${SALT}`));
}

function store(key: string, value: ArrayBuffer) {
  const asArray = Array.from(new Uint8Array(value));
  PASSCODE_IDB_STORE.set(key, asArray);
}

async function load(key: string) {
  const cached = await PASSCODE_IDB_STORE.get<number[]>(key);
  if (cached) {
    const asArrayBuffer = new Uint8Array(cached).buffer;
    return asArrayBuffer;
  }
  // Fallback for old data
  return cacheApi.fetch(LEGACY_PASSCODE_CACHE_NAME, key, cacheApi.Type.ArrayBuffer);
}

async function aesEncrypt(plaintext: string, pwHash: ArrayBuffer) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const alg = { name: 'AES-GCM', iv };
  const key = await crypto.subtle.importKey('raw', pwHash, alg, false, ['encrypt']);
  const ptUint8 = new TextEncoder().encode(plaintext);
  const ctBuffer = await crypto.subtle.encrypt(alg, key, ptUint8);
  const ct = new Uint8Array(ctBuffer);
  const result = new Uint8Array(IV_LENGTH + ct.length);
  result.set(iv, 0);
  result.set(ct, IV_LENGTH);
  return result.buffer;
}

async function aesDecrypt(data: ArrayBuffer, pwHash: ArrayBuffer) {
  const dataArray = new Uint8Array(data);
  const iv = dataArray.slice(0, IV_LENGTH);
  const alg = { name: 'AES-GCM', iv };
  const key = await crypto.subtle.importKey('raw', pwHash, alg, false, ['decrypt']);
  const ct = dataArray.slice(IV_LENGTH);
  const plainBuffer = await crypto.subtle.decrypt(alg, key, ct);

  return new TextDecoder().decode(plainBuffer);
}
