const BigInt = require('big-integer');
const IGE = require('../crypto/IGE');
const AuthKey = require('../crypto/AuthKey');
const Factorizator = require('../crypto/Factorizator');
const RSA = require('../crypto/RSA');
const Helpers = require('../Helpers');
const {
    constructors,
    requests,
} = require('../tl');
const BinaryReader = require('../extensions/BinaryReader');
const { SecurityError } = require('../errors/Common');

/**
 * Executes the authentication process with the Telegram servers.
 * @param sender a connected {MTProtoPlainSender}.
 * @param log
 * @returns {Promise<{authKey: *, timeOffset: *}>}
 */
async function doAuthentication(sender, log) {
    // Step 1 sending: PQ Request, endianness doesn't matter since it's random
    let bytes = Helpers.generateRandomBytes(16);

    const nonce = Helpers.readBigIntFromBuffer(bytes, false, true);

    const resPQ = await sender.send(new requests.ReqPqMulti({ nonce }));
    log.debug('Starting authKey generation step 1');

    if (!(resPQ instanceof constructors.ResPQ)) {
        throw new Error(`Step 1 answer was ${resPQ}`);
    }
    if (resPQ.nonce.neq(nonce)) {
        throw new SecurityError('Step 1 invalid nonce from server');
    }
    const pq = Helpers.readBigIntFromBuffer(resPQ.pq, false, true);
    log.debug('Finished authKey generation step 1');
    log.debug('Starting authKey generation step 2');
    // Step 2 sending: DH Exchange
    let {
        p,
        q,
    } = Factorizator.factorize(pq);

    // TODO Bring back after `Factorizator` fix.
    p = Helpers.getByteArray(p);
    q = Helpers.getByteArray(q);

    bytes = Helpers.generateRandomBytes(32);
    const newNonce = Helpers.readBigIntFromBuffer(bytes, true, true);

    const pqInnerData = new constructors.PQInnerData({
        pq: Helpers.getByteArray(pq), // unsigned
        p,
        q,
        nonce: resPQ.nonce,
        serverNonce: resPQ.serverNonce,
        newNonce,
    });

    // sha_digest + data + random_bytes
    let cipherText;
    let targetFingerprint;
    for (const fingerprint of resPQ.serverPublicKeyFingerprints) {
        cipherText = await RSA.encrypt(fingerprint.toString(), pqInnerData.getBytes());
        if (cipherText !== undefined) {
            targetFingerprint = fingerprint;
            break;
        }
    }
    if (cipherText === undefined) {
        throw new SecurityError('Step 2 could not find a valid key for fingerprints');
    }

    const serverDhParams = await sender.send(
        new requests.ReqDHParams({
            nonce: resPQ.nonce,
            serverNonce: resPQ.serverNonce,
            p,
            q,
            publicKeyFingerprint: targetFingerprint,
            encryptedData: cipherText,
        }),
    );
    if (!(serverDhParams instanceof constructors.ServerDHParamsOk
        || serverDhParams instanceof constructors.ServerDHParamsFail)) {
        throw new Error(`Step 2.1 answer was ${serverDhParams}`);
    }
    if (serverDhParams.nonce.neq(resPQ.nonce)) {
        throw new SecurityError('Step 2 invalid nonce from server');
    }

    if (serverDhParams.serverNonce.neq(resPQ.serverNonce)) {
        throw new SecurityError('Step 2 invalid server nonce from server');
    }

    if (serverDhParams instanceof constructors.ServerDHParamsFail) {
        const sh = await Helpers.sha1(Helpers.toSignedLittleBuffer(newNonce, 32)
            .slice(4, 20));
        const nnh = Helpers.readBigIntFromBuffer(sh, true, true);
        if (serverDhParams.newNonceHash.neq(nnh)) {
            throw new SecurityError('Step 2 invalid DH fail nonce from server');
        }
    }
    if (!(serverDhParams instanceof constructors.ServerDHParamsOk)) {
        throw new Error(`Step 2.2 answer was ${serverDhParams}`);
    }
    log.debug('Finished authKey generation step 2');
    log.debug('Starting authKey generation step 3');

    // Step 3 sending: Complete DH Exchange
    const {
        key,
        iv,
    } = await Helpers.generateKeyDataFromNonce(resPQ.serverNonce, newNonce);
    if (serverDhParams.encryptedAnswer.length % 16 !== 0) {
        // See PR#453
        throw new SecurityError('Step 3 AES block size mismatch');
    }
    const ige = new IGE(key, iv);
    const plainTextAnswer = ige.decryptIge(serverDhParams.encryptedAnswer);
    const reader = new BinaryReader(plainTextAnswer);
    reader.read(20); // hash sum
    const serverDhInner = reader.tgReadObject();
    if (!(serverDhInner instanceof constructors.ServerDHInnerData)) {
        throw new Error(`Step 3 answer was ${serverDhInner}`);
    }

    if (serverDhInner.nonce.neq(resPQ.nonce)) {
        throw new SecurityError('Step 3 Invalid nonce in encrypted answer');
    }
    if (serverDhInner.serverNonce.neq(resPQ.serverNonce)) {
        throw new SecurityError('Step 3 Invalid server nonce in encrypted answer');
    }
    const dhPrime = Helpers.readBigIntFromBuffer(serverDhInner.dhPrime, false, false);
    const ga = Helpers.readBigIntFromBuffer(serverDhInner.gA, false, false);
    const timeOffset = serverDhInner.serverTime - Math.floor(new Date().getTime() / 1000);
    const b = Helpers.readBigIntFromBuffer(Helpers.generateRandomBytes(256), false, false);
    const gb = Helpers.modExp(BigInt(serverDhInner.g), b, dhPrime);
    const gab = Helpers.modExp(ga, b, dhPrime);

    // Prepare client DH Inner Data
    const clientDhInner = new constructors.ClientDHInnerData({
        nonce: resPQ.nonce,
        serverNonce: resPQ.serverNonce,
        retryId: 0, // TODO Actual retry ID
        gB: Helpers.getByteArray(gb, false),
    }).getBytes();

    const clientDdhInnerHashed = Buffer.concat([await Helpers.sha1(clientDhInner), clientDhInner]);
    // Encryption

    const clientDhEncrypted = ige.encryptIge(clientDdhInnerHashed);
    const dhGen = await sender.send(
        new requests.SetClientDHParams({
            nonce: resPQ.nonce,
            serverNonce: resPQ.serverNonce,
            encryptedData: clientDhEncrypted,
        }),
    );
    const nonceTypes = [constructors.DhGenOk, constructors.DhGenRetry, constructors.DhGenFail];
    if (!(dhGen instanceof nonceTypes[0] || dhGen instanceof nonceTypes[1] || dhGen instanceof nonceTypes[2])) {
        throw new Error(`Step 3.1 answer was ${dhGen}`);
    }
    const { name } = dhGen.constructor;
    if (dhGen.nonce.neq(resPQ.nonce)) {
        throw new SecurityError(`Step 3 invalid ${name} nonce from server`);
    }
    if (dhGen.serverNonce.neq(resPQ.serverNonce)) {
        throw new SecurityError(`Step 3 invalid ${name} server nonce from server`);
    }
    const authKey = new AuthKey();
    await authKey.setKey(Helpers.getByteArray(gab));

    const nonceNumber = 1 + nonceTypes.indexOf(dhGen.constructor);

    const newNonceHash = await authKey.calcNewNonceHash(newNonce, nonceNumber);
    const dhHash = dhGen[`newNonceHash${nonceNumber}`];

    if (dhHash.neq(newNonceHash)) {
        throw new SecurityError('Step 3 invalid new nonce hash');
    }

    if (!(dhGen instanceof constructors.DhGenOk)) {
        throw new Error(`Step 3.2 answer was ${dhGen}`);
    }
    log.debug('Finished authKey generation step 3');

    return {
        authKey,
        timeOffset,
    };
}


module.exports = doAuthentication;
