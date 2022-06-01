import * as cacheApi from './cacheApi';
import { PASSCODE_CACHE_NAME } from '../config';

const IV_LENGTH = 12;
const SALT = 'harder better faster stronger';

let currentPasscodeHash: ArrayBuffer | undefined;

export async function setupPasscode(passcode: string) {
  currentPasscodeHash = await sha256(passcode);
}

export async function encryptSession(sessionJson?: string, globalJson?: string) {
  if (!currentPasscodeHash) {
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

export async function decryptSession(passcode: string) {
  const passcodeHash = await sha256(passcode);

  const [sessionEncrypted, globalEncrypted] = await Promise.all([
    load('sessionEncrypted'),
    load('globalEncrypted'),
  ]);

  if (!sessionEncrypted || !globalEncrypted) {
    throw new Error('[api/passcode] Missing required stored fields');
  }

  const [sessionJson, globalJson] = await Promise.all([
    aesDecrypt(sessionEncrypted, passcodeHash),
    aesDecrypt(globalEncrypted, passcodeHash),
  ]);

  currentPasscodeHash = passcodeHash;

  return { sessionJson, globalJson };
}

export function forgetPasscode() {
  currentPasscodeHash = undefined;
}

export function clearEncryptedSession() {
  forgetPasscode();
  return cacheApi.clear(PASSCODE_CACHE_NAME);
}

function sha256(plaintext: string) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${plaintext}${SALT}`));
}

async function store(key: string, value: ArrayBuffer) {
  await cacheApi.save(PASSCODE_CACHE_NAME, key, value);
}

function load(key: string) {
  return cacheApi.fetch(PASSCODE_CACHE_NAME, key, cacheApi.Type.ArrayBuffer);
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
