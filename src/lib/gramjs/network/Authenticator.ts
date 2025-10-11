/**
 * Executes the authentication process with the Telegram servers.
 * @param sender a connected {MTProtoPlainSender}.
 * @param log
 * @returns {Promise<{authKey: *, timeOffset: *}>}
 */

import type MTProtoPlainSender from './MTProtoPlainSender';

import { IGE } from '../crypto/IGE';
import { SERVER_KEYS } from '../crypto/RSA';
import { SecurityError } from '../errors';
import { BinaryReader } from '../extensions';
import { Api } from '../tl';

import { AuthKey } from '../crypto/AuthKey';
import { Factorizator } from '../crypto/Factorizator';
import {
  bufferXor,
  generateKeyDataFromNonce,
  generateRandomBytes,
  getByteArray,
  modExp,
  readBigIntFromBuffer,
  readBufferFromBigInt,
  sha1,
  sha256,
  toSignedLittleBuffer,
} from '../Helpers';

const RETRIES = 20;

export async function doAuthentication(sender: MTProtoPlainSender, log: any) {
  // Step 1 sending: PQ Request, endianness doesn't matter since it's random
  let bytes = generateRandomBytes(16);

  const nonce = readBigIntFromBuffer(bytes, false, true);
  const resPQ = await sender.send(new Api.ReqPqMulti({ nonce }));
  log.debug('Starting authKey generation step 1');

  if (!(resPQ instanceof Api.ResPQ)) {
    throw new SecurityError(`Step 1 answer was ${resPQ}`);
  }
  if (resPQ.nonce !== nonce) {
    throw new SecurityError('Step 1 invalid nonce from server');
  }
  const pq = readBigIntFromBuffer(resPQ.pq, false, true);
  log.debug('Finished authKey generation step 1');
  // Step 2 sending: DH Exchange
  const { p, q } = Factorizator.factorize(pq);

  const pBuffer = getByteArray(p);
  const qBuffer = getByteArray(q);

  bytes = generateRandomBytes(32);
  const newNonce = readBigIntFromBuffer(bytes, true, true);
  const pqInnerData = new Api.PQInnerData({
    pq: getByteArray(pq), // unsigned
    p: pBuffer,
    q: qBuffer,
    nonce: resPQ.nonce,
    serverNonce: resPQ.serverNonce,
    newNonce,
  }).getBytes();
  if (pqInnerData.length > 144) {
    throw new SecurityError('Step 1 invalid nonce from server');
  }
  let targetFingerprint;
  let targetKey;
  for (const fingerprint of resPQ.serverPublicKeyFingerprints) {
    targetKey = SERVER_KEYS.get(fingerprint);
    if (targetKey !== undefined) {
      targetFingerprint = fingerprint;
      break;
    }
  }
  if (targetFingerprint === undefined || targetKey === undefined) {
    throw new SecurityError(
      'Step 2 could not find a valid key for fingerprints',
    );
  }
  // Value should be padded to be made 192 exactly
  const padding = generateRandomBytes(192 - pqInnerData.length);
  const dataWithPadding = Buffer.concat([pqInnerData, padding]);
  const dataPadReversed = Buffer.from(dataWithPadding).reverse();

  let encryptedData;
  for (let i = 0; i < RETRIES; i++) {
    const tempKey = generateRandomBytes(32);
    const shaDigestKeyWithData = await sha256(Buffer.concat([tempKey, dataWithPadding]));
    const dataWithHash = Buffer.concat([dataPadReversed, shaDigestKeyWithData]);

    const ige = new IGE(tempKey, Buffer.alloc(32));
    const aesEncrypted = ige.encryptIge(dataWithHash);
    const tempKeyXor = bufferXor(tempKey, await sha256(aesEncrypted));

    const keyAesEncrypted = Buffer.concat([tempKeyXor, aesEncrypted]);
    const keyAesEncryptedInt = readBigIntFromBuffer(keyAesEncrypted, false, false);
    if (keyAesEncryptedInt >= targetKey.n) {
      log.debug('Aes key greater than RSA. retrying');
      continue;
    }
    const encryptedDataBuffer = modExp(keyAesEncryptedInt, BigInt(targetKey.e), targetKey.n);
    encryptedData = readBufferFromBigInt(encryptedDataBuffer, 256, false, false);

    break;
  }
  if (encryptedData === undefined) {
    throw new SecurityError(
      'Step 2 could create a secure encrypted key',
    );
  }
  log.debug('Step 2 : Generated a secure aes encrypted data');

  const serverDhParams = await sender.send(
    new Api.ReqDHParams({
      nonce: resPQ.nonce,
      serverNonce: resPQ.serverNonce,
      p: pBuffer,
      q: qBuffer,
      publicKeyFingerprint: targetFingerprint,
      encryptedData,
    }),
  );

  if (
    !(
      serverDhParams instanceof Api.ServerDHParamsOk
      || serverDhParams instanceof Api.ServerDHParamsFail
    )
  ) {
    throw new Error(`Step 2.1 answer was ${serverDhParams}`);
  }
  if (serverDhParams.nonce !== resPQ.nonce) {
    throw new SecurityError('Step 2 invalid nonce from server');
  }

  if (serverDhParams.serverNonce !== resPQ.serverNonce) {
    throw new SecurityError('Step 2 invalid server nonce from server');
  }

  if (serverDhParams instanceof Api.ServerDHParamsFail) {
    const sh = await sha1(
      toSignedLittleBuffer(newNonce, 32).slice(4, 20),
    );
    const nnh = readBigIntFromBuffer(sh, true, true);
    if (serverDhParams.newNonceHash !== nnh) {
      throw new SecurityError('Step 2 invalid DH fail nonce from server');
    }
  }
  if (!(serverDhParams instanceof Api.ServerDHParamsOk)) {
    throw new Error(`Step 2.2 answer was ${serverDhParams.className}`);
  }
  log.debug('Finished authKey generation step 2');
  log.debug('Starting authKey generation step 3');

  // Step 3 sending: Complete DH Exchange
  const { key, iv } = await generateKeyDataFromNonce(
    resPQ.serverNonce,
    newNonce,
  );
  if (serverDhParams.encryptedAnswer.length % 16 !== 0) {
    // See PR#453
    throw new SecurityError('Step 3 AES block size mismatch');
  }
  const ige = new IGE(key, iv);
  const plainTextAnswer = ige.decryptIge(serverDhParams.encryptedAnswer);
  const reader = new BinaryReader(plainTextAnswer);
  const hash = reader.read(20); // hash sum
  const serverDhInner = reader.tgReadObject();
  if (!(serverDhInner instanceof Api.ServerDHInnerData)) {
    throw new Error(`Step 3 answer was ${serverDhInner}`);
  }
  const sha1Answer = await sha1(serverDhInner.getBytes());
  if (!(hash.equals(sha1Answer))) {
    throw new SecurityError('Step 3 Invalid hash answer');
  }

  if (serverDhInner.nonce !== resPQ.nonce) {
    throw new SecurityError('Step 3 Invalid nonce in encrypted answer');
  }
  if (serverDhInner.serverNonce !== resPQ.serverNonce) {
    throw new SecurityError(
      'Step 3 Invalid server nonce in encrypted answer',
    );
  }
  if (serverDhInner.g !== 3 || serverDhInner.dhPrime.toString('hex') !== 'c71caeb9c6b1c9048e6c522f70f13'
    + 'f73980d40238e3e21c14934d037563d930f48198a0aa7c14058229493d22530f4dbfa336f6e0ac925139543aed44cce7c3720fd5'
    + '1f69458705ac68cd4fe6b6b13abdc9746512969328454f18faf8c595f642477fe96bb2a941d5bcd1d4ac8cc49880708fa9b378e3'
    + 'c4f3a9060bee67cf9a4a4a695811051907e162753b56b0f6b410dba74d8a84b2a14b3144e0ef1284754fd17ed950d5965b4b9dd4'
    + '6582db1178d169c6bc465b0d6ff9ca3928fef5b9ae4e418fc15e83ebea0f87fa9ff5eed70050ded2849f47bf959d956850ce9298'
    + '51f0d8115f635b105ee2e4e15d04b2454bf6f4fadf034b10403119cd8e3b92fcc5b') {
    throw new SecurityError('Step 3 invalid dhPrime or g');
  }

  const dhPrime = readBigIntFromBuffer(
    serverDhInner.dhPrime,
    false,
    false,
  );
  const ga = readBigIntFromBuffer(serverDhInner.gA, false, false);
  const timeOffset = serverDhInner.serverTime - Math.floor(Date.now() / 1000);
  const b = readBigIntFromBuffer(
    generateRandomBytes(256),
    false,
    false,
  );
  const gb = modExp(BigInt(serverDhInner.g), b, dhPrime);
  const gab = modExp(ga, b, dhPrime);

  if (ga <= 1n) {
    throw new SecurityError('Step 3 failed ga > 1 check');
  }

  if (gb <= 1n) {
    throw new SecurityError('Step 3 failed gb > 1 check');
  }

  if (ga >= (dhPrime - 1n)) {
    throw new SecurityError('Step 3 failed ga < dh_prime - 1 check');
  }

  const toCheckAgainst = 2n ** (2048n - 64n);
  if (!(ga > toCheckAgainst && ga < (dhPrime - toCheckAgainst))) {
    throw new SecurityError('Step 3 failed dh_prime - 2^{2048-64} < ga < 2^{2048-64} check');
  }
  if (!(gb > toCheckAgainst && gb < (dhPrime - toCheckAgainst))) {
    throw new SecurityError('Step 3 failed dh_prime - 2^{2048-64} < gb < 2^{2048-64} check');
  }

  // Prepare client DH Inner Data
  const clientDhInner = new Api.ClientDHInnerData({
    nonce: resPQ.nonce,
    serverNonce: resPQ.serverNonce,
    retryId: 0n, // TODO Actual retry ID
    gB: getByteArray(gb, false),
  }).getBytes();

  const clientDdhInnerHashed = Buffer.concat([
    await sha1(clientDhInner),
    clientDhInner,
  ]);
    // Encryption

  const clientDhEncrypted = ige.encryptIge(clientDdhInnerHashed);
  const dhGen = await sender.send(
    new Api.SetClientDHParams({
      nonce: resPQ.nonce,
      serverNonce: resPQ.serverNonce,
      encryptedData: clientDhEncrypted,
    }),
  );
  const nonceTypes = [Api.DhGenOk, Api.DhGenRetry, Api.DhGenFail];
  // TS being weird again.
  const nonceTypesString = ['DhGenOk', 'DhGenRetry', 'DhGenFail'];
  if (
    !(
      dhGen instanceof nonceTypes[0]
      || dhGen instanceof nonceTypes[1]
      || dhGen instanceof nonceTypes[2]
    )
  ) {
    throw new Error(`Step 3.1 answer was ${dhGen}`);
  }
  const { name } = dhGen.constructor;
  if (dhGen.nonce !== resPQ.nonce) {
    throw new SecurityError(`Step 3 invalid ${name} nonce from server`);
  }
  if (dhGen.serverNonce !== resPQ.serverNonce) {
    throw new SecurityError(
      `Step 3 invalid ${name} server nonce from server`,
    );
  }
  const authKey = new AuthKey();
  await authKey.setKey(getByteArray(gab));

  const nonceNumber = 1 + nonceTypesString.indexOf(dhGen.className);

  const newNonceHash = await authKey.calcNewNonceHash(newNonce, nonceNumber);
  // @ts-expect-error
  const dhHash = dhGen[`newNonceHash${nonceNumber}`] as bigint;

  if (dhHash !== newNonceHash) {
    throw new SecurityError('Step 3 invalid new nonce hash');
  }

  if (!(dhGen instanceof Api.DhGenOk)) {
    throw new Error(`Step 3.2 answer was ${dhGen.className}`);
  }
  log.debug('Finished authKey generation step 3');

  return { authKey, timeOffset };
}
