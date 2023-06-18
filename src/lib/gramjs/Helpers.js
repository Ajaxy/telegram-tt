const BigInt = require('big-integer');
const crypto = require('./crypto/crypto');

/**
 * converts a buffer to big int
 * @param buffer
 * @param little
 * @param signed
 * @returns {bigInt.BigInteger}
 */
function readBigIntFromBuffer(buffer, little = true, signed = false) {
    let randBuffer = Buffer.from(buffer);
    const bytesNumber = randBuffer.length;
    if (little) {
        randBuffer = randBuffer.reverse();
    }
    let bigInt = BigInt(randBuffer.toString('hex'), 16);
    if (signed && Math.floor(bigInt.toString(2).length / 8) >= bytesNumber) {
        bigInt = bigInt.subtract(BigInt(2)
            .pow(BigInt(bytesNumber * 8)));
    }
    return bigInt;
}

/**
 * Special case signed little ints
 * @param big
 * @param number
 * @returns {Buffer}
 */
function toSignedLittleBuffer(big, number = 8) {
    const bigNumber = BigInt(big);
    const byteArray = [];
    for (let i = 0; i < number; i++) {
        byteArray[i] = bigNumber.shiftRight(8 * i)
            .and(255);
    }
    return Buffer.from(byteArray);
}

/**
 * converts a big int to a buffer
 * @param bigInt {bigInt.BigInteger}
 * @param bytesNumber
 * @param little
 * @param signed
 * @returns {Buffer}
 */
function readBufferFromBigInt(bigInt, bytesNumber, little = true, signed = false) {
    bigInt = BigInt(bigInt);
    const bitLength = bigInt.bitLength().toJSNumber();

    const bytes = Math.ceil(bitLength / 8);
    if (bytesNumber < bytes) {
        throw new Error('OverflowError: int too big to convert');
    }
    if (!signed && bigInt.lesser(BigInt(0))) {
        throw new Error('Cannot convert to unsigned');
    }
    let below = false;
    if (bigInt.lesser(BigInt(0))) {
        below = true;
        bigInt = bigInt.abs();
    }

    const hex = bigInt.toString(16).padStart(bytesNumber * 2, '0');
    let buffer = Buffer.from(hex, 'hex');

    if (signed && below) {
        buffer[buffer.length - 1] = 256 - buffer[buffer.length - 1];
        for (let i = 0; i < buffer.length - 1; i++) {
            buffer[i] = 255 - buffer[i];
        }
    }
    if (little) {
        buffer = buffer.reverse();
    }

    return buffer;
}

/**
 * Generates a random long integer (8 bytes), which is optionally signed
 * @returns {BigInteger}
 */
function generateRandomLong(signed = true) {
    return readBigIntFromBuffer(generateRandomBytes(8), true, signed);
}

/**
 * .... really javascript
 * @param n {number}
 * @param m {number}
 * @returns {number}
 */
function mod(n, m) {
    return ((n % m) + m) % m;
}

/**
 * returns a positive bigInt
 * @param n {BigInt}
 * @param m {BigInt}
 * @returns {BigInt}
 */
function bigIntMod(n, m) {
    return ((n.remainder(m)).add(m)).remainder(m);
}

/**
 * Generates a random bytes array
 * @param count
 * @returns {Buffer}
 */
function generateRandomBytes(count) {
    return Buffer.from(crypto.randomBytes(count));
}

/**
 * Calculate the key based on Telegram guidelines, specifying whether it's the client or not
 * @param sharedKey
 * @param msgKey
 * @param client
 * @returns {{iv: Buffer, key: Buffer}}
 */

/* CONTEST
this is mtproto 1 (mostly used for secret chats)
async function calcKey(sharedKey, msgKey, client) {
    const x = client === true ? 0 : 8
    const [sha1a, sha1b, sha1c, sha1d] = await Promise.all([
        sha1(Buffer.concat([msgKey, sharedKey.slice(x, x + 32)])),
        sha1(Buffer.concat([sharedKey.slice(x + 32, x + 48), msgKey, sharedKey.slice(x + 48, x + 64)])),
        sha1(Buffer.concat([sharedKey.slice(x + 64, x + 96), msgKey])),
        sha1(Buffer.concat([msgKey, sharedKey.slice(x + 96, x + 128)]))
    ])
    const key = Buffer.concat([sha1a.slice(0, 8), sha1b.slice(8, 20), sha1c.slice(4, 16)])
    const iv = Buffer.concat([sha1a.slice(8, 20), sha1b.slice(0, 8), sha1c.slice(16, 20), sha1d.slice(0, 8)])
    return {
        key,
        iv
    }
}

 */

/**
 * Generates the key data corresponding to the given nonces
 * @param serverNonce
 * @param newNonce
 * @returns {{key: Buffer, iv: Buffer}}
 */
async function generateKeyDataFromNonce(serverNonce, newNonce) {
    serverNonce = toSignedLittleBuffer(serverNonce, 16);
    newNonce = toSignedLittleBuffer(newNonce, 32);
    const [hash1, hash2, hash3] = await Promise.all([
        sha1(Buffer.concat([newNonce, serverNonce])),
        sha1(Buffer.concat([serverNonce, newNonce])),
        sha1(Buffer.concat([newNonce, newNonce])),
    ]);
    const keyBuffer = Buffer.concat([hash1, hash2.slice(0, 12)]);
    const ivBuffer = Buffer.concat([hash2.slice(12, 20), hash3, newNonce.slice(0, 4)]);
    return {
        key: keyBuffer,
        iv: ivBuffer,
    };
}

function convertToLittle(buf) {
    const correct = Buffer.alloc(buf.length * 4);

    for (let i = 0; i < buf.length; i++) {
        correct.writeUInt32BE(buf[i], i * 4);
    }
    return correct;
}

/**
 * Calculates the SHA1 digest for the given data
 * @param data
 * @returns {Promise}
 */
function sha1(data) {
    const shaSum = crypto.createHash('sha1');
    shaSum.update(data);
    return shaSum.digest();
}

/**
 * Calculates the SHA256 digest for the given data
 * @param data
 * @returns {Promise}
 */
function sha256(data) {
    const shaSum = crypto.createHash('sha256');
    shaSum.update(data);
    return shaSum.digest();
}

/**
 * Fast mod pow for RSA calculation. a^b % n
 * @param a
 * @param b
 * @param n
 * @returns {bigInt.BigInteger}
 */
function modExp(a, b, n) {
    a = a.remainder(n);
    let result = BigInt.one;
    let x = a;
    while (b.greater(BigInt.zero)) {
        const leastSignificantBit = b.remainder(BigInt(2));
        b = b.divide(BigInt(2));
        if (leastSignificantBit.eq(BigInt.one)) {
            result = result.multiply(x);
            result = result.remainder(n);
        }
        x = x.multiply(x);
        x = x.remainder(n);
    }
    return result;
}

/**
 * Gets the arbitrary-length byte array corresponding to the given integer
 * @param integer {any}
 * @param signed {boolean}
 * @returns {Buffer}
 */
function getByteArray(integer, signed = false) {
    const bits = integer.toString(2).length;
    const byteLength = Math.floor((bits + 8 - 1) / 8);
    return readBufferFromBigInt(BigInt(integer), byteLength, false, signed);
}

/**
 * returns a random int from min (inclusive) and max (inclusive)
 * @param min
 * @param max
 * @returns {number}
 */
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleeps a specified amount of time
 * @param ms time in milliseconds
 * @returns {Promise}
 */
const sleep = (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});

/**
 * Helper to export two buffers of same length
 * @returns {Buffer}
 */

function bufferXor(a, b) {
    const res = [];
    for (let i = 0; i < a.length; i++) {
        res.push(a[i] ^ b[i]);
    }
    return Buffer.from(res);
}

/**
 * Checks if the obj is an array
 * @param obj
 * @returns {boolean}
 */
/*
CONTEST
we do'nt support array requests anyway
function isArrayLike(obj) {
    if (!obj) return false
    const l = obj.length
    if (typeof l != 'number' || l < 0) return false
    if (Math.floor(l) !== l) return false
    // fast check
    if (l > 0 && !(l - 1 in obj)) return false
    // more complete check (optional)
    for (let i = 0; i < l; ++i) {
        if (!(i in obj)) return false
    }
    return true
}
*/

// Taken from https://stackoverflow.com/questions/18638900/javascript-crc32/18639999#18639999
function makeCRCTable() {
    let c;
    const crcTable = [];
    for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) {
            c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        crcTable[n] = c;
    }
    return crcTable;
}

let crcTable;

function crc32(buf) {
    if (!crcTable) {
        crcTable = makeCRCTable();
    }
    if (!Buffer.isBuffer(buf)) {
        buf = Buffer.from(buf);
    }
    let crc = -1;

    for (let index = 0; index < buf.length; index++) {
        const byte = buf[index];
        crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ (-1)) >>> 0;
}

module.exports = {
    readBigIntFromBuffer,
    readBufferFromBigInt,
    generateRandomLong,
    mod,
    crc32,
    generateRandomBytes,
    // calcKey,
    generateKeyDataFromNonce,
    sha1,
    sha256,
    bigIntMod,
    modExp,
    getRandomInt,
    sleep,
    getByteArray,
    // isArrayLike,
    toSignedLittleBuffer,
    convertToLittle,
    bufferXor,
};
