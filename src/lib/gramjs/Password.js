const BigInt = require('big-integer');
const { constructors } = require('./tl');
const {
    readBigIntFromBuffer,
    readBufferFromBigInt,
    sha256,
    bigIntMod,
    modExp,
    generateRandomBytes,
} = require('./Helpers');
const crypto = require('./crypto/crypto');

const SIZE_FOR_HASH = 256;

/**
 *
 *
 * @param prime{BigInteger}
 * @param g{BigInteger}
 */

/*
We don't support changing passwords yet
function checkPrimeAndGoodCheck(prime, g) {
    console.error('Unsupported function `checkPrimeAndGoodCheck` call. Arguments:', prime, g)

    const goodPrimeBitsCount = 2048
    if (prime < 0 || prime.bitLength() !== goodPrimeBitsCount) {
        throw new Error(`bad prime count ${prime.bitLength()},expected ${goodPrimeBitsCount}`)
    }
    // TODO this is kinda slow
    if (Factorizator.factorize(prime)[0] !== 1) {
        throw new Error('give "prime" is not prime')
    }
    if (g.eq(BigInt(2))) {
        if ((prime.remainder(BigInt(8))).neq(BigInt(7))) {
            throw new Error(`bad g ${g}, mod8 ${prime % 8}`)
        }
    } else if (g.eq(BigInt(3))) {
        if ((prime.remainder(BigInt(3))).neq(BigInt(2))) {
            throw new Error(`bad g ${g}, mod3 ${prime % 3}`)
        }
        // eslint-disable-next-line no-empty
    } else if (g.eq(BigInt(4))) {

    } else if (g.eq(BigInt(5))) {
        if (!([ BigInt(1), BigInt(4) ].includes(prime.remainder(BigInt(5))))) {
            throw new Error(`bad g ${g}, mod8 ${prime % 5}`)
        }
    } else if (g.eq(BigInt(6))) {
        if (!([ BigInt(19), BigInt(23) ].includes(prime.remainder(BigInt(24))))) {
            throw new Error(`bad g ${g}, mod8 ${prime % 24}`)
        }
    } else if (g.eq(BigInt(7))) {
        if (!([ BigInt(3), BigInt(5), BigInt(6) ].includes(prime.remainder(BigInt(7))))) {
            throw new Error(`bad g ${g}, mod8 ${prime % 7}`)
        }
    } else {
        throw new Error(`bad g ${g}`)
    }
    const primeSub1Div2 = (prime.subtract(BigInt(1))).divide(BigInt(2))
    if (Factorizator.factorize(primeSub1Div2)[0] !== 1) {
        throw new Error('(prime - 1) // 2 is not prime')
    }
}
*/
/**
 *
 * @param primeBytes{Buffer}
 * @param g{number}
 */
function checkPrimeAndGood(primeBytes, g) {
    const goodPrime = Buffer.from([
        0xC7, 0x1C, 0xAE, 0xB9, 0xC6, 0xB1, 0xC9, 0x04, 0x8E, 0x6C, 0x52, 0x2F, 0x70, 0xF1, 0x3F, 0x73,
        0x98, 0x0D, 0x40, 0x23, 0x8E, 0x3E, 0x21, 0xC1, 0x49, 0x34, 0xD0, 0x37, 0x56, 0x3D, 0x93, 0x0F,
        0x48, 0x19, 0x8A, 0x0A, 0xA7, 0xC1, 0x40, 0x58, 0x22, 0x94, 0x93, 0xD2, 0x25, 0x30, 0xF4, 0xDB,
        0xFA, 0x33, 0x6F, 0x6E, 0x0A, 0xC9, 0x25, 0x13, 0x95, 0x43, 0xAE, 0xD4, 0x4C, 0xCE, 0x7C, 0x37,
        0x20, 0xFD, 0x51, 0xF6, 0x94, 0x58, 0x70, 0x5A, 0xC6, 0x8C, 0xD4, 0xFE, 0x6B, 0x6B, 0x13, 0xAB,
        0xDC, 0x97, 0x46, 0x51, 0x29, 0x69, 0x32, 0x84, 0x54, 0xF1, 0x8F, 0xAF, 0x8C, 0x59, 0x5F, 0x64,
        0x24, 0x77, 0xFE, 0x96, 0xBB, 0x2A, 0x94, 0x1D, 0x5B, 0xCD, 0x1D, 0x4A, 0xC8, 0xCC, 0x49, 0x88,
        0x07, 0x08, 0xFA, 0x9B, 0x37, 0x8E, 0x3C, 0x4F, 0x3A, 0x90, 0x60, 0xBE, 0xE6, 0x7C, 0xF9, 0xA4,
        0xA4, 0xA6, 0x95, 0x81, 0x10, 0x51, 0x90, 0x7E, 0x16, 0x27, 0x53, 0xB5, 0x6B, 0x0F, 0x6B, 0x41,
        0x0D, 0xBA, 0x74, 0xD8, 0xA8, 0x4B, 0x2A, 0x14, 0xB3, 0x14, 0x4E, 0x0E, 0xF1, 0x28, 0x47, 0x54,
        0xFD, 0x17, 0xED, 0x95, 0x0D, 0x59, 0x65, 0xB4, 0xB9, 0xDD, 0x46, 0x58, 0x2D, 0xB1, 0x17, 0x8D,
        0x16, 0x9C, 0x6B, 0xC4, 0x65, 0xB0, 0xD6, 0xFF, 0x9C, 0xA3, 0x92, 0x8F, 0xEF, 0x5B, 0x9A, 0xE4,
        0xE4, 0x18, 0xFC, 0x15, 0xE8, 0x3E, 0xBE, 0xA0, 0xF8, 0x7F, 0xA9, 0xFF, 0x5E, 0xED, 0x70, 0x05,
        0x0D, 0xED, 0x28, 0x49, 0xF4, 0x7B, 0xF9, 0x59, 0xD9, 0x56, 0x85, 0x0C, 0xE9, 0x29, 0x85, 0x1F,
        0x0D, 0x81, 0x15, 0xF6, 0x35, 0xB1, 0x05, 0xEE, 0x2E, 0x4E, 0x15, 0xD0, 0x4B, 0x24, 0x54, 0xBF,
        0x6F, 0x4F, 0xAD, 0xF0, 0x34, 0xB1, 0x04, 0x03, 0x11, 0x9C, 0xD8, 0xE3, 0xB9, 0x2F, 0xCC, 0x5B,
    ]);
    if (goodPrime.equals(primeBytes)) {
        if ([3, 4, 5, 7].includes(g)) {
            return; // It's good
        }
    }
    throw new Error('Changing passwords unsupported');
    // checkPrimeAndGoodCheck(readBigIntFromBuffer(primeBytes, false), g)
}

/**
 *
 * @param number{BigInteger}
 * @param p{BigInteger}
 * @returns {boolean}
 */
function isGoodLarge(number, p) {
    return (number.greater(BigInt(0)) && (p.subtract(number)
        .greater(BigInt(0))));
}

/**
 *
 * @param number {Buffer}
 * @returns {Buffer}
 */
function numBytesForHash(number) {
    return Buffer.concat([Buffer.alloc(SIZE_FOR_HASH - number.length), number]);
}

/**
 *
 * @param g {Buffer}
 * @returns {Buffer}
 */
function bigNumForHash(g) {
    return readBufferFromBigInt(g, SIZE_FOR_HASH, false);
}

/**
 *
 * @param modexp {BigInteger}
 * @param prime {BigInteger}
 * @returns {Boolean}
 */
function isGoodModExpFirst(modexp, prime) {
    const diff = prime.subtract(modexp);

    const minDiffBitsCount = 2048 - 64;
    const maxModExpSize = 256;

    return !(diff.lesser(BigInt(0)) || diff.bitLength() < minDiffBitsCount
        || modexp.bitLength() < minDiffBitsCount
        || Math.floor((modexp.bitLength() + 7) / 8) > maxModExpSize);
}

function xor(a, b) {
    const length = Math.min(a.length, b.length);

    for (let i = 0; i < length; i++) {
        a[i] ^= b[i];
    }

    return a;
}

/**
 *
 * @param password{Buffer}
 * @param salt{Buffer}
 * @param iterations{number}
 * @returns {*}
 */

function pbkdf2sha512(password, salt, iterations) {
    return crypto.pbkdf2(password, salt, iterations, 64, 'sha512');
}

/**
 *
 * @param algo {constructors.PasswordKdfAlgoSHA256SHA256PBKDF2HMACSHA512iter100000SHA256ModPow}
 * @param password
 * @returns {Buffer|*}
 */
async function computeHash(algo, password) {
    const hash1 = await sha256(Buffer.concat([algo.salt1, Buffer.from(password, 'utf-8'), algo.salt1]));
    const hash2 = await sha256(Buffer.concat([algo.salt2, hash1, algo.salt2]));
    const hash3 = await pbkdf2sha512(hash2, algo.salt1, 100000);
    return sha256(Buffer.concat([algo.salt2, hash3, algo.salt2]));
}

/**
 *
 * @param algo {constructors.PasswordKdfAlgoSHA256SHA256PBKDF2HMACSHA512iter100000SHA256ModPow}
 * @param password
 */
async function computeDigest(algo, password) {
    try {
        checkPrimeAndGood(algo.p, algo.g);
    } catch (e) {
        throw new Error('bad p/g in password');
    }

    const value = modExp(BigInt(algo.g),
        readBigIntFromBuffer(await computeHash(algo, password), false),
        readBigIntFromBuffer(algo.p, false));
    return bigNumForHash(value);
}

/**
 *
 * @param request {constructors.account.Password}
 * @param password {string}
 */
async function computeCheck(request, password) {
    const algo = request.currentAlgo;
    if (!(algo instanceof constructors.PasswordKdfAlgoSHA256SHA256PBKDF2HMACSHA512iter100000SHA256ModPow)) {
        throw new Error(`Unsupported password algorithm ${algo.className}`);
    }

    const pwHash = await computeHash(algo, password);
    const p = readBigIntFromBuffer(algo.p, false);
    const { g } = algo;
    const B = readBigIntFromBuffer(request.srp_B, false);
    try {
        checkPrimeAndGood(algo.p, g);
    } catch (e) {
        throw new Error('bad /g in password');
    }
    if (!isGoodLarge(B, p)) {
        throw new Error('bad b in check');
    }
    const x = readBigIntFromBuffer(pwHash, false);
    const pForHash = numBytesForHash(algo.p);
    const gForHash = bigNumForHash(g);
    const bForHash = numBytesForHash(request.srp_B);
    const gX = modExp(BigInt(g), x, p);
    const k = readBigIntFromBuffer(await sha256(Buffer.concat([pForHash, gForHash])), false);
    const kgX = bigIntMod(k.multiply(gX), p);
    const generateAndCheckRandom = async () => {
        const randomSize = 256;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const random = generateRandomBytes(randomSize);
            const a = readBigIntFromBuffer(random, false);
            const A = modExp(BigInt(g), a, p);
            if (isGoodModExpFirst(A, p)) {
                const aForHash = bigNumForHash(A);
                const u = readBigIntFromBuffer(await sha256(Buffer.concat([aForHash, bForHash])), false);
                if (u.greater(BigInt(0))) {
                    return [a, aForHash, u];
                }
            }
        }
    };
    const [a, aForHash, u] = await generateAndCheckRandom();
    const gB = bigIntMod(B.subtract(kgX), p);
    if (!isGoodModExpFirst(gB, p)) {
        throw new Error('bad gB');
    }

    const ux = u.multiply(x);
    const aUx = a.add(ux);
    const S = modExp(gB, aUx, p);
    const [K, pSha, gSha, salt1Sha, salt2Sha] = await Promise.all([
        sha256(bigNumForHash(S)),
        sha256(pForHash),
        sha256(gForHash),
        sha256(algo.salt1),
        sha256(algo.salt2),
    ]);
    const M1 = await sha256(Buffer.concat([
        xor(pSha, gSha),
        salt1Sha,
        salt2Sha,
        aForHash,
        bForHash,
        K,
    ]));

    return new constructors.InputCheckPasswordSRP({
        srpId: request.srpId,
        A: Buffer.from(aForHash),
        M1,

    });
}

module.exports = {
    computeCheck,
    computeDigest,
};
