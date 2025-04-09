import BigInt from 'big-integer';

import { createHash, randomBytes } from './crypto/crypto';

export function readBigIntFromBuffer(buffer: Buffer | number[], little = true, signed = false): BigInt.BigInteger {
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

export function toSignedLittleBuffer(big: BigInt.BigInteger, number = 8) {
    const bigNumber = BigInt(big);
    const byteArray: number[] = [];
    for (let i = 0; i < number; i++) {
        byteArray[i] = bigNumber.shiftRight(8 * i)
            .and(255)
            .toJSNumber();
    }

    return Buffer.from(byteArray);
}

export function readBufferFromBigInt(bigInt: BigInt.BigInteger, bytesNumber: number, little = true, signed = false) {
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

export function generateRandomLong(signed = true) {
    return readBigIntFromBuffer(generateRandomBytes(8), true, signed);
}

export function mod(n: number, m: number) {
    return ((n % m) + m) % m;
}

export function bigIntMod(n: BigInt.BigInteger, m: BigInt.BigInteger) {
    return ((n.remainder(m)).add(m)).remainder(m);
}

export function generateRandomBytes(count: number) {
    return Buffer.from(randomBytes(count));
}

export async function generateKeyDataFromNonce(
    serverNonceBigInt: BigInt.BigInteger, newNonceBigInt: BigInt.BigInteger,
) {
    const serverNonce = toSignedLittleBuffer(serverNonceBigInt, 16);
    const newNonce = toSignedLittleBuffer(newNonceBigInt, 32);
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

export function convertToLittle(buf: Uint32Array) {
    const correct = Buffer.alloc(buf.length * 4);

    for (let i = 0; i < buf.length; i++) {
        correct.writeUInt32BE(buf[i], i * 4);
    }
    return correct;
}

export function sha1(data: Buffer): Promise<Buffer> {
    const shaSum = createHash('sha1');
    shaSum.update(data);
    return shaSum.digest();
}

export function sha256(data: Buffer): Promise<Buffer> {
    const shaSum = createHash('sha256');
    shaSum.update(data);
    return shaSum.digest();
}

export function modExp(
    a: bigInt.BigInteger,
    b: bigInt.BigInteger,
    n: bigInt.BigInteger,
) {
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

export function getByteArray(integer: BigInt.BigInteger, signed = false) {
    const bits = integer.toString(2).length;
    const byteLength = Math.floor((bits + 8 - 1) / 8);
    return readBufferFromBigInt(BigInt(integer), byteLength, false, signed);
}

export function getRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

export function bufferXor(a: Buffer, b: Buffer) {
    const res = [];
    for (let i = 0; i < a.length; i++) {
        res.push(a[i] ^ b[i]);
    }
    return Buffer.from(res);
}

// Taken from https://stackoverflow.com/questions/18638900/javascript-crc32/18639999#18639999
export const CRC32_TABLE = (() => {
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
})();

export function crc32(buf: Buffer | string) {
    if (!Buffer.isBuffer(buf)) {
        buf = Buffer.from(buf);
    }
    let crc = -1;

    for (let index = 0; index < buf.length; index++) {
        const byte = buf[index];
        crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ (-1)) >>> 0;
}
