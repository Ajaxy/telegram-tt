import bigInt from 'big-integer';
import {
    generateRandomBytes,
    modExp,
    readBigIntFromBuffer,
    readBufferFromBigInt,
    sha1,
} from '../Helpers';

export const SERVER_KEYS = [
    {
        fingerprint: bigInt('-3591632762792723036'),
        n: bigInt('bbededbec7160c0944bd5ca54de32be45a54d808e0ab3a101cf8f3a7af6bd1802dab46bcad7d0c51eefc17f15102a05a11b656e960731770233a5358a4eb6fbf01a197dac60a0ce2ba76ddf67c1c28904c0d64bd3bb333ffcc63cffb30201e15e7a5dc8ce86b8d41c9fc69e214aa2e9b4d317847189ebe719cb7acbe954cabdec66ba6fec6ddc745fb4763f672d5d1b9cecf2ea6e8803a51222a2961bb522d85f323146dcd17a4e21ab3bd614dd88b115b272ebb8ed1e4bf915aaec70cd9f0b989643678fd72ea35d1eb8b065374239dcbe8cd839e3eb1fd8c67279b35268f8db1fc7dbc223250f448c4736dac3ceb9ab8ad0817642208687e4dfb0a08ad7cf7',16),
        e: 65537
    }
].reduce((acc, { fingerprint, ...keyInfo }) => {
    acc.set(fingerprint.toString(), keyInfo);
    return acc;
}, new Map<string, { n: bigInt.BigInteger; e: number }>());

/**
 * Encrypts the given data known the fingerprint to be used
 * in the way Telegram requires us to do so (sha1(data) + data + padding)

 * @param fingerprint the fingerprint of the RSA key.
 * @param data the data to be encrypted.
 * @returns {Buffer|*|undefined} the cipher text, or undefined if no key matching this fingerprint is found.
 */
export async function encrypt(fingerprint: bigInt.BigInteger, data: Buffer) {
    const key = SERVER_KEYS.get(fingerprint.toString());
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
