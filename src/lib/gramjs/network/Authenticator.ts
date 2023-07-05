/**
 * Executes the authentication process with the Telegram servers.
 * @param sender a connected {MTProtoPlainSender}.
 * @param log
 * @returns {Promise<{authKey: *, timeOffset: *}>}
 */
// eslint-disable-next-line import/no-named-default
import { default as Api } from '../tl/api';
import { SecurityError } from '../errors';
// eslint-disable-next-line import/no-named-default
import type { default as MTProtoPlainSender } from './MTProtoPlainSender';
import { SERVER_KEYS } from '../crypto/RSA';

const bigInt = require('big-integer');
const IGE = require('../crypto/IGE');
const AuthKey = require('../crypto/AuthKey');
const Factorizator = require('../crypto/Factorizator');
const Helpers = require('../Helpers');
const BinaryReader = require('../extensions/BinaryReader');

const RETRIES = 20;

export async function doAuthentication(sender: MTProtoPlainSender, log: any) {
    // Step 1 sending: PQ Request, endianness doesn't matter since it's random
    let bytes = Helpers.generateRandomBytes(16);

    const nonce = Helpers.readBigIntFromBuffer(bytes, false, true);
    const resPQ = await sender.send(new Api.ReqPqMulti({ nonce }));
    log.debug('Starting authKey generation step 1');

    if (!(resPQ instanceof Api.ResPQ)) {
        throw new SecurityError(`Step 1 answer was ${resPQ}`);
    }
    if (resPQ.nonce.neq(nonce)) {
        throw new SecurityError('Step 1 invalid nonce from server');
    }
    const pq = Helpers.readBigIntFromBuffer(resPQ.pq, false, true);
    log.debug('Finished authKey generation step 1');
    // Step 2 sending: DH Exchange
    const { p, q } = Factorizator.factorize(pq);

    const pBuffer = Helpers.getByteArray(p);
    const qBuffer = Helpers.getByteArray(q);

    bytes = Helpers.generateRandomBytes(32);
    const newNonce = Helpers.readBigIntFromBuffer(bytes, true, true);
    const pqInnerData = new Api.PQInnerData({
        pq: Helpers.getByteArray(pq), // unsigned
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
        targetKey = SERVER_KEYS.get(fingerprint.toString());
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
    const padding = Helpers.generateRandomBytes(192 - pqInnerData.length);
    const dataWithPadding = Buffer.concat([pqInnerData, padding]);
    const dataPadReversed = Buffer.from(dataWithPadding).reverse();

    let encryptedData;
    for (let i = 0; i < RETRIES; i++) {
        const tempKey = Helpers.generateRandomBytes(32);
        const shaDigestKeyWithData = await Helpers.sha256(Buffer.concat([tempKey, dataWithPadding]));
        const dataWithHash = Buffer.concat([dataPadReversed, shaDigestKeyWithData]);

        const ige = new IGE(tempKey, Buffer.alloc(32));
        const aesEncrypted = ige.encryptIge(dataWithHash);
        const tempKeyXor = Helpers.bufferXor(tempKey, await Helpers.sha256(aesEncrypted));

        const keyAesEncrypted = Buffer.concat([tempKeyXor, aesEncrypted]);
        const keyAesEncryptedInt = Helpers.readBigIntFromBuffer(keyAesEncrypted, false, false);
        if (keyAesEncryptedInt.greaterOrEquals(targetKey.n)) {
            log.debug('Aes key greater than RSA. retrying');
            continue;
        }
        const encryptedDataBuffer = Helpers.modExp(keyAesEncryptedInt, bigInt(targetKey.e), targetKey.n);
        encryptedData = Helpers.readBufferFromBigInt(encryptedDataBuffer, 256, false, false);

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
    if (serverDhParams.nonce.neq(resPQ.nonce)) {
        throw new SecurityError('Step 2 invalid nonce from server');
    }

    if (serverDhParams.serverNonce.neq(resPQ.serverNonce)) {
        throw new SecurityError('Step 2 invalid server nonce from server');
    }

    if (serverDhParams instanceof Api.ServerDHParamsFail) {
        const sh = await Helpers.sha1(
            Helpers.toSignedLittleBuffer(newNonce, 32).slice(4, 20),
        );
        const nnh = Helpers.readBigIntFromBuffer(sh, true, true);
        if (serverDhParams.newNonceHash.neq(nnh)) {
            throw new SecurityError('Step 2 invalid DH fail nonce from server');
        }
    }
    if (!(serverDhParams instanceof Api.ServerDHParamsOk)) {
        throw new Error(`Step 2.2 answer was ${serverDhParams}`);
    }
    log.debug('Finished authKey generation step 2');
    log.debug('Starting authKey generation step 3');

    // Step 3 sending: Complete DH Exchange
    const { key, iv } = await Helpers.generateKeyDataFromNonce(
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
    const sha1Answer = await Helpers.sha1(serverDhInner.getBytes());
    if (!(hash.equals(sha1Answer))) {
        throw new SecurityError('Step 3 Invalid hash answer');
    }

    if (serverDhInner.nonce.neq(resPQ.nonce)) {
        throw new SecurityError('Step 3 Invalid nonce in encrypted answer');
    }
    if (serverDhInner.serverNonce.neq(resPQ.serverNonce)) {
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

    const dhPrime = Helpers.readBigIntFromBuffer(
        serverDhInner.dhPrime,
        false,
        false,
    );
    const ga = Helpers.readBigIntFromBuffer(serverDhInner.gA, false, false);
    const timeOffset = serverDhInner.serverTime - Math.floor(Date.now() / 1000);
    const b = Helpers.readBigIntFromBuffer(
        Helpers.generateRandomBytes(256),
        false,
        false,
    );
    const gb = Helpers.modExp(bigInt(serverDhInner.g), b, dhPrime);
    const gab = Helpers.modExp(ga, b, dhPrime);

    if (ga.lesserOrEquals(1)) {
        throw new SecurityError('Step 3 failed ga > 1 check');
    }

    if (gb.lesserOrEquals(1)) {
        throw new SecurityError('Step 3 failed gb > 1 check');
    }

    if (ga.greater(dhPrime.minus(1))) {
        throw new SecurityError('Step 3 failed ga > dh_prime - 1 check');
    }

    const toCheckAgainst = bigInt(2).pow(2048 - 64);
    if (!(ga.greaterOrEquals(toCheckAgainst) && ga.lesserOrEquals(dhPrime.minus(toCheckAgainst)))) {
        throw new SecurityError('Step 3 failed dh_prime - 2^{2048-64} < ga < 2^{2048-64} check');
    }
    if (!(gb.greaterOrEquals(toCheckAgainst) && gb.lesserOrEquals(dhPrime.minus(toCheckAgainst)))) {
        throw new SecurityError('Step 3 failed dh_prime - 2^{2048-64} < gb < 2^{2048-64} check');
    }

    // Prepare client DH Inner Data
    const clientDhInner = new Api.ClientDHInnerData({
        nonce: resPQ.nonce,
        serverNonce: resPQ.serverNonce,
        retryId: bigInt.zero, // TODO Actual retry ID
        gB: Helpers.getByteArray(gb, false),
    }).getBytes();

    const clientDdhInnerHashed = Buffer.concat([
        await Helpers.sha1(clientDhInner),
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
    if (dhGen.nonce.neq(resPQ.nonce)) {
        throw new SecurityError(`Step 3 invalid ${name} nonce from server`);
    }
    if (dhGen.serverNonce.neq(resPQ.serverNonce)) {
        throw new SecurityError(
            `Step 3 invalid ${name} server nonce from server`,
        );
    }
    const authKey = new AuthKey();
    await authKey.setKey(Helpers.getByteArray(gab));

    const nonceNumber = 1 + nonceTypesString.indexOf(dhGen.className);

    const newNonceHash = await authKey.calcNewNonceHash(newNonce, nonceNumber);
    // @ts-ignore
    const dhHash = dhGen[`newNonceHash${nonceNumber}`];

    if (dhHash.neq(newNonceHash)) {
        throw new SecurityError('Step 3 invalid new nonce hash');
    }

    if (!(dhGen instanceof Api.DhGenOk)) {
        throw new Error(`Step 3.2 answer was ${dhGen}`);
    }
    log.debug('Finished authKey generation step 3');

    return { authKey, timeOffset };
}
