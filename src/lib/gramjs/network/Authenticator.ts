/**
 * Executes the authentication process with the Telegram servers.
 * @param sender a connected {MTProtoPlainSender}.
 * @param log
 * @returns {Promise<{authKey: *, timeOffset: *}>}
 */
import type MTProtoPlainSender from './MTProtoPlainSender';

import { compareBuffersConstantTime, concat, copy } from '../../../util/encoding/buffer';
import { IGE } from '../crypto/IGE';
import { SERVER_KEYS } from '../crypto/RSA';
import { SecurityError } from '../errors';
import { BinaryReader } from '../extensions';
import { Api } from '../tl';

import { AuthKey } from '../crypto/AuthKey';
import { Factorizator } from '../crypto/Factorizator';
import {
  bufferXor,
  DH_PRIME_BYTES,
  generateDhPrivateExponent,
  generateKeyDataFromNonce,
  generateRandomBytes,
  getByteArray,
  modExp,
  readBigIntFromBuffer,
  readBufferFromBigInt,
  sha1,
  sha256,
  toSignedLittleBuffer,
  validateDhParameters,
  validateDhPublicValue,
} from '../Helpers';

const RETRIES = 20;
const MAX_PQ_BYTES = 8;
const MAX_PQ = 0x7FFFFFFFFFFFFFFFn;
const MAX_DH_GEN_ATTEMPTS = 5;

export async function doAuthentication(
  sender: MTProtoPlainSender,
  log: any,
  dcId: number,
  isTestServer?: boolean,
) {
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
  // Limit unauthenticated factorization to the protocol's canonical 63-bit `pq`
  // https://core.telegram.org/mtproto/auth_key#dh-exchange-initiation
  if (
    resPQ.pq.length === 0
    || resPQ.pq.length > MAX_PQ_BYTES
    || resPQ.pq[0] === 0
  ) {
    throw new SecurityError('Step 1 invalid pq encoding');
  }
  const pq = readBigIntFromBuffer(resPQ.pq, false);
  if (pq > MAX_PQ || pq < 15n || pq % 2n === 0n) {
    throw new SecurityError('Step 1 invalid pq value');
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
  log.debug('Finished authKey generation step 1');
  // Step 2 sending: DH Exchange
  const { p, q } = Factorizator.factorize(pq);

  const pBuffer = getByteArray(p);
  const qBuffer = getByteArray(q);

  bytes = generateRandomBytes(32);
  const newNonce = readBigIntFromBuffer(bytes, true, true);
  const pqInnerData = new Api.PQInnerDataDc({
    pq: getByteArray(pq), // unsigned
    p: pBuffer,
    q: qBuffer,
    nonce: resPQ.nonce,
    serverNonce: resPQ.serverNonce,
    newNonce,
    dc: buildAuthDcId(dcId, isTestServer),
  }).getBytes();
  if (pqInnerData.length > 144) {
    throw new SecurityError('Step 1 invalid nonce from server');
  }
  // Value should be padded to be made 192 exactly
  const padding = generateRandomBytes(192 - pqInnerData.length);
  const dataWithPadding = concat(pqInnerData, padding);
  const dataPadReversed = copy(dataWithPadding).reverse();

  let encryptedData;
  for (let i = 0; i < RETRIES; i++) {
    const tempKey = generateRandomBytes(32);
    const shaDigestKeyWithData = await sha256(concat(tempKey, dataWithPadding));
    const dataWithHash = concat(dataPadReversed, shaDigestKeyWithData);

    const ige = new IGE(tempKey, new Uint8Array(32));
    const aesEncrypted = ige.encryptIge(dataWithHash);
    const tempKeyXor = bufferXor(tempKey, await sha256(aesEncrypted));

    const keyAesEncrypted = concat(tempKeyXor, aesEncrypted);
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
    const newNonceHash = (
      await sha1(toSignedLittleBuffer(newNonce, 32))
    ).slice(4, 20);
    const expectedNewNonceHash = readBigIntFromBuffer(newNonceHash, true, true);
    if (serverDhParams.newNonceHash !== expectedNewNonceHash) {
      throw new SecurityError('Step 2 invalid DH fail nonce from server');
    }
    throw new SecurityError('Step 2 server rejected DH parameters');
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
  const paddingLength = plainTextAnswer.length - reader.tellPosition();
  if (paddingLength < 0 || paddingLength > 15) {
    throw new SecurityError('Step 3 invalid encrypted answer padding');
  }
  const sha1Answer = await sha1(serverDhInner.getBytes());
  if (!compareBuffersConstantTime(hash, sha1Answer)) {
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
  const dhPrime = validateDhParameters(
    serverDhInner.dhPrime,
    serverDhInner.g,
  );
  const ga = readBigIntFromBuffer(serverDhInner.gA, false, false);
  const timeOffset = serverDhInner.serverTime - Math.floor(Date.now() / 1000);
  validateDhPublicValue(ga, dhPrime, 'g_a');
  let retryId = 0n;

  // A retry uses a fresh `b` and identifies the preceding failed key
  // https://core.telegram.org/mtproto/auth_key#dh-key-exchange-complete
  for (let attempt = 0; attempt < MAX_DH_GEN_ATTEMPTS; attempt++) {
    const b = generateDhPrivateExponent(dhPrime);
    const gb = modExp(BigInt(serverDhInner.g), b, dhPrime);
    const gab = modExp(ga, b, dhPrime);
    validateDhPublicValue(gb, dhPrime, 'g_b');

    const clientDhInner = new Api.ClientDHInnerData({
      nonce: resPQ.nonce,
      serverNonce: resPQ.serverNonce,
      retryId,
      gB: readBufferFromBigInt(gb, DH_PRIME_BYTES, false),
    }).getBytes();
    const clientDhEncrypted = ige.encryptIge(
      concat(await sha1(clientDhInner), clientDhInner),
    );
    const dhGen = await sender.send(
      new Api.SetClientDHParams({
        nonce: resPQ.nonce,
        serverNonce: resPQ.serverNonce,
        encryptedData: clientDhEncrypted,
      }),
    );
    if (
      !(
        dhGen instanceof Api.DhGenOk
        || dhGen instanceof Api.DhGenRetry
        || dhGen instanceof Api.DhGenFail
      )
    ) {
      throw new Error(`Step 3.1 answer was ${dhGen}`);
    }
    if (dhGen.nonce !== resPQ.nonce) {
      throw new SecurityError(
        `Step 3 invalid ${dhGen.className} nonce from server`,
      );
    }
    if (dhGen.serverNonce !== resPQ.serverNonce) {
      throw new SecurityError(
        `Step 3 invalid ${dhGen.className} server nonce from server`,
      );
    }

    const authKeyBytes = readBufferFromBigInt(gab, DH_PRIME_BYTES, false);
    const authKeyHash = await sha1(authKeyBytes);
    const authKey = new AuthKey(authKeyBytes, authKeyHash);
    let nonceNumber: number;
    let dhHash: bigint;
    if (dhGen instanceof Api.DhGenOk) {
      nonceNumber = 1;
      dhHash = dhGen.newNonceHash1;
    } else if (dhGen instanceof Api.DhGenRetry) {
      nonceNumber = 2;
      dhHash = dhGen.newNonceHash2;
    } else {
      nonceNumber = 3;
      dhHash = dhGen.newNonceHash3;
    }
    if (dhHash !== await authKey.calcNewNonceHash(newNonce, nonceNumber)) {
      throw new SecurityError('Step 3 invalid new nonce hash');
    }

    if (dhGen instanceof Api.DhGenOk) {
      // https://core.telegram.org/mtproto/auth_key#dh-key-exchange-complete
      const serverSalt = readBigIntFromBuffer(bufferXor(
        toSignedLittleBuffer(newNonce, 32).slice(0, 8),
        toSignedLittleBuffer(resPQ.serverNonce, 16).slice(0, 8),
      ), true, true);
      log.debug('Finished authKey generation step 3');
      return { authKey, timeOffset, serverSalt };
    }
    if (dhGen instanceof Api.DhGenFail) {
      throw new SecurityError('Step 3 server rejected DH key');
    }

    retryId = readBigIntFromBuffer(authKeyHash.slice(0, 8), true, true);
  }

  throw new SecurityError('Step 3 DH retry limit exceeded');
}

function buildAuthDcId(dcId: number, isTestServer?: boolean) {
  return isTestServer ? dcId + 10000 : dcId;
}
