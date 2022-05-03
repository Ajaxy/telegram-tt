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
    {
        fingerprint: bigInt('-5595554452916591101'),
        n: bigInt(
            '2534288944884041556497168959071347320689884775908477905258202659454602246385394058588521595116849196570'
            + '8222649399180603818074200620463776135424884632162512403163793083921641631564740959529419359595852941166'
            + '8489405859523376133330223960965841179548922160312292373029437018775884567383353986024616752250817918203'
            + '9315375750495263623495132323782003654358104782690612092797248736680529211579223142368426126233039432475'
            + '0785450942589751755390156647751460719351439969059949569615302809050721500330239005077889855323917509948'
            + '255722081644689442127297605422579707142646660768825302832201908302295573257427896031830742328565032949',
        ),
        e: 65537,
    },
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
