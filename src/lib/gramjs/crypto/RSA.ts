import bigInt from 'big-integer';
import {
    generateRandomBytes,
    modExp,
    readBigIntFromBuffer,
    readBufferFromBigInt,
    sha1,
} from '../Helpers';

const PUBLIC_KEYS = [
    {
        fingerprint: bigInt('-3414540481677951611'),
        n: bigInt(
            '2937959817066933702298617714945612856538843112005886376816255642404751219133084745514657634448776440866'
            + '1701890505066208632169112269581063774293102577308490531282748465986139880977280302242772832972539403531'
            + '3160108704012876427630091361567343395380424193887227773571344877461690935390938502512438971889287359033'
            + '8945177273024525306296338410881284207988753897636046529094613963869149149606209957083647645485599631919'
            + '2747663615955633778034897140982517446405334423701359108810182097749467210509584293428076654573384828809'
            + '574217079944388301239431309115013843331317877374435868468779972014486325557807783825502498215169806323',
        ),
        e: 65537,
    },
];

export const _serverKeys = new Map<string, { n: bigInt.BigInteger; e: number }>();

PUBLIC_KEYS.forEach(({ fingerprint, ...keyInfo }) => {
    _serverKeys.set(fingerprint.toString(),
        keyInfo);
});

/**
 * Encrypts the given data known the fingerprint to be used
 * in the way Telegram requires us to do so (sha1(data) + data + padding)

 * @param fingerprint the fingerprint of the RSA key.
 * @param data the data to be encrypted.
 * @returns {Buffer|*|undefined} the cipher text, or undefined if no key matching this fingerprint is found.
 */
export async function encrypt(fingerprint: bigInt.BigInteger, data: Buffer) {
    const key = _serverKeys.get(fingerprint.toString());
    if (!key) {
        return undefined;
    }

    // len(sha1.digest) is always 20, so we're left with 255 - 20 - x padding
    const rand = generateRandomBytes(235 - data.length);

    const toEncrypt = Buffer.concat([await sha1(data), data, rand]);

    // rsa module rsa.encrypt adds 11 bits for padding which we don't want
    // rsa module uses rsa.transform.bytes2int(to_encrypt), easier way:
    const payload = readBigIntFromBuffer(toEncrypt, false);
    const encrypted = modExp(payload, bigInt(key.e), key.n);
    // rsa module uses transform.int2bytes(encrypted, keylength), easier:
    return readBufferFromBigInt(encrypted, 256, false);
}
