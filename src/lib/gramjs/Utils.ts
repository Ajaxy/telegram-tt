import type { Entity, EntityLike } from './types';

import { Api } from './tl';

// eslint-disable-next-line max-len
const JPEG_HEADER = Buffer.from('ffd8ffe000104a46494600010100000100010000ffdb004300281c1e231e19282321232d2b28303c64413c37373c7b585d4964918099968f808c8aa0b4e6c3a0aadaad8a8cc8ffcbdaeef5ffffff9bc1fffffffaffe6fdfff8ffdb0043012b2d2d3c353c76414176f8a58ca5f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8ffc00011080000000003012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f00', 'hex');
const JPEG_FOOTER = Buffer.from('ffd9', 'hex');

// eslint-disable-next-line @typescript-eslint/naming-convention
function _raiseCastFail(entity: any, target: string) {
    throw new Error(`Cannot cast ${entity.className} to any kind of ${target}`);
}

/**
 Gets the input peer for the given "entity" (user, chat or channel).

 A ``TypeError`` is raised if the given entity isn't a supported type
 or if ``check_hash is True`` but the entity's ``accessHash is None``
 *or* the entity contains ``min`` information. In this case, the hash
 cannot be used for general purposes, and thus is not returned to avoid
 any issues which can derive from invalid access hashes.

 Note that ``check_hash`` **is ignored** if an input peer is already
 passed since in that case we assume the user knows what they're doing.
 This is key to getting entities by explicitly passing ``hash = 0``.

 * @param entity
 * @param allowSelf
 * @param checkHash
 */
export function getInputPeer(entity: Entity, allowSelf = true, checkHash = true): Api.TypeInputPeer {
    if (entity.SUBCLASS_OF_ID === 0xc91c90b6) { // crc32(b'InputPeer')
        return entity;
    }

    if (entity instanceof Api.User) {
        if (entity.self && allowSelf) {
            return new Api.InputPeerSelf();
        } else if (entity.accessHash !== undefined || !checkHash) {
            return new Api.InputPeerUser({
                userId: entity.id,
                accessHash: entity.accessHash!,
            });
        } else {
            throw new Error('User without accessHash or min info cannot be input');
        }
    }
    if (entity instanceof Api.Chat || entity instanceof Api.ChatEmpty
        || entity instanceof Api.ChatForbidden) {
        return new Api.InputPeerChat({ chatId: entity.id });
    }
    if (entity instanceof Api.Channel) {
        if (entity.accessHash !== undefined || !checkHash) {
            return new Api.InputPeerChannel({
                channelId: entity.id,
                accessHash: entity.accessHash!,
            });
        } else {
            throw new TypeError('Channel without accessHash or min info cannot be input');
        }
    }
    if (entity instanceof Api.ChannelForbidden) {
        // "channelForbidden are never min", and since their hash is
        // also not optional, we assume that this truly is the case.
        return new Api.InputPeerChannel({
            channelId: entity.id,
            accessHash: entity.accessHash,
        });
    }

    if (entity instanceof Api.InputUser) {
        return new Api.InputPeerUser({
            userId: entity.userId,
            accessHash: entity.accessHash,
        });
    }
    if (entity instanceof Api.InputChannel) {
        return new Api.InputPeerChannel({
            channelId: entity.channelId,
            accessHash: entity.accessHash,
        });
    }
    if (entity instanceof Api.UserEmpty) {
        return new Api.InputPeerEmpty();
    }

    _raiseCastFail(entity, 'InputPeer');
    return new Api.InputPeerEmpty();
}

/**
 * Adds the JPG header and footer to a stripped image.
 * Ported from https://github.com/telegramdesktop/
 * tdesktop/blob/bec39d89e19670eb436dc794a8f20b657cb87c71/Telegram/SourceFiles/ui/image/image.cpp#L225

 * @param stripped{Buffer}
 * @returns {Buffer}
 */
export function strippedPhotoToJpg(stripped: Buffer) {
    // Note: Changes here should update _stripped_real_length
    if (stripped.length < 3 || stripped[0] !== 1) {
        return stripped;
    }
    const header = Buffer.from(JPEG_HEADER);
    header[164] = stripped[1];
    header[166] = stripped[2];
    return Buffer.concat([header, stripped.slice(3), JPEG_FOOTER]);
}

/**
 * Gets the appropriated part size when downloading files,
 * given an initial file size.
 * @param fileSize
 * @returns {Number}
 */
export function getDownloadPartSize(fileSize: number) {
    if (fileSize <= 65536) { // 64KB
        return 64;
    }
    if (fileSize <= 104857600) { // 100MB
        return 128;
    }
    if (fileSize <= 786432000) { // 750MB
        return 256;
    }
    if (fileSize <= 2097152000) { // 2000MB
        return 512;
    }
    if (fileSize <= 4194304000) { // 4000MB
        return 1024;
    }

    throw new Error('File size too large');
}

/**
 * Gets the appropriated part size when uploading files,
 * given an initial file size.
 * @param fileSize
 * @returns {Number}
 */
export function getUploadPartSize(fileSize: number) {
    if (fileSize <= 104857600) { // 100MB
        return 128;
    }
    if (fileSize <= 786432000) { // 750MB
        return 256;
    }
    if (fileSize <= 2097152000) { // 2000MB
        return 512;
    }
    if (fileSize <= 4194304000) { // 4000MB
        return 512;
    }

    throw new Error('File size too large');
}

export function getMessageId(message: number | Api.TypeMessage) {
    if (message === undefined) {
        return undefined;
    }
    if (typeof message === 'number') {
        return message;
    }
    if (message.SUBCLASS_OF_ID === 0x790009e3) { // crc32(b'Message')
        return message.id;
    }
    throw new Error(`Invalid message type: ${message.constructor.name}`);
}

/**
 * Gets the display name for the given :tl:`User`,
 :tl:`Chat` or :tl:`Channel`. Returns an empty string otherwise
 * @param entity
 */
export function getDisplayName(entity: Entity) {
    if (entity instanceof Api.User) {
        if (entity.lastName && entity.firstName) {
            return `${entity.firstName} ${entity.lastName}`;
        } else if (entity.firstName) {
            return entity.firstName;
        } else if (entity.lastName) {
            return entity.lastName;
        } else {
            return '';
        }
    } else if (entity instanceof Api.Chat || entity instanceof Api.Channel) {
        return entity.title;
    }
    return '';
}

/**
 * Returns the appropriate DC based on the id
 * @param dcId the id of the DC.
 * @param downloadDC whether to use -1 DCs or not
 * (These only support downloading/uploading and not creating a new AUTH key)
 * @return {{port: number, ipAddress: string, id: number}}
 */
export function getDC(dcId: number, downloadDC = false) {
    // TODO Move to external config
    switch (dcId) {
        case 1:
            return {
                id: 1,
                ipAddress: `zws1${downloadDC ? '-1' : ''}.web.telegram.org`,
                port: 443,
            };
        case 2:
            return {
                id: 2,
                ipAddress: `zws2${downloadDC ? '-1' : ''}.web.telegram.org`,
                port: 443,
            };
        case 3:
            return {
                id: 3,
                ipAddress: `zws3${downloadDC ? '-1' : ''}.web.telegram.org`,
                port: 443,
            };
        case 4:
            return {
                id: 4,
                ipAddress: `zws4${downloadDC ? '-1' : ''}.web.telegram.org`,
                port: 443,
            };
        case 5:
            return {
                id: 5,
                ipAddress: `zws5${downloadDC ? '-1' : ''}.web.telegram.org`,
                port: 443,
            };
        default:
            throw new Error(`Cannot find the DC with the ID of ${dcId}`);
    }
    // TODO chose based on current connection method
    /*
    if (!this._config) {
        this._config = await this.invoke(new requests.help.GetConfig())
    }
    if (cdn && !this._cdnConfig) {
        this._cdnConfig = await this.invoke(new requests.help.GetCdnConfig())
        for (const pk of this._cdnConfig.publicKeys) {
            addKey(pk.publicKey)
        }
    }
    for (const DC of this._config.dcOptions) {
        if (DC.id === dcId && Boolean(DC.ipv6) === this._useIPV6 && Boolean(DC.cdn) === cdn) {
            return DC
        }
    } */
}
