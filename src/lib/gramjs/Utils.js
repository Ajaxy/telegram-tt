const { constructors } = require('./tl');

// eslint-disable-next-line max-len
const JPEG_HEADER = Buffer.from('ffd8ffe000104a46494600010100000100010000ffdb004300281c1e231e19282321232d2b28303c64413c37373c7b585d4964918099968f808c8aa0b4e6c3a0aadaad8a8cc8ffcbdaeef5ffffff9bc1fffffffaffe6fdfff8ffdb0043012b2d2d3c353c76414176f8a58ca5f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8f8ffc00011080000000003012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f00', 'hex');
const JPEG_FOOTER = Buffer.from('ffd9', 'hex');

// eslint-disable-next-line @typescript-eslint/naming-convention
function _raiseCastFail(entity, target) {
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
function getInputPeer(entity, allowSelf = true, checkHash = true) {
    if (entity.SUBCLASS_OF_ID === undefined) {
        // e.g. custom.Dialog (can't cyclic import).

        if (allowSelf && 'inputEntity' in entity) {
            return entity.inputEntity;
        } else if ('entity' in entity) {
            return getInputPeer(entity.entity);
        } else {
            _raiseCastFail(entity, 'InputPeer');
        }
    }
    if (entity.SUBCLASS_OF_ID === 0xc91c90b6) { // crc32(b'InputPeer')
        return entity;
    }

    if (entity instanceof constructors.User) {
        if (entity.isSelf && allowSelf) {
            return new constructors.InputPeerSelf();
        } else if (entity.accessHash !== undefined || !checkHash) {
            return new constructors.InputPeerUser({
                userId: entity.id,
                accessHash: entity.accessHash,
            });
        } else {
            throw new Error('User without accessHash or min info cannot be input');
        }
    }
    if (entity instanceof constructors.Chat || entity instanceof constructors.ChatEmpty
        || entity instanceof constructors.ChatForbidden) {
        return new constructors.InputPeerChat({ chatId: entity.id });
    }
    if (entity instanceof constructors.Channel) {
        if (entity.accessHash !== undefined || !checkHash) {
            return new constructors.InputPeerChannel({
                channelId: entity.id,
                accessHash: entity.accessHash,
            });
        } else {
            throw new TypeError('Channel without accessHash or min info cannot be input');
        }
    }
    if (entity instanceof constructors.ChannelForbidden) {
        // "channelForbidden are never min", and since their hash is
        // also not optional, we assume that this truly is the case.
        return new constructors.InputPeerChannel({
            channelId: entity.id,
            accessHash: entity.accessHash,
        });
    }

    if (entity instanceof constructors.InputUser) {
        return new constructors.InputPeerUser({
            userId: entity.userId,
            accessHash: entity.accessHash,
        });
    }
    if (entity instanceof constructors.InputChannel) {
        return new constructors.InputPeerChannel({
            channelId: entity.channelId,
            accessHash: entity.accessHash,
        });
    }
    if (entity instanceof constructors.UserEmpty) {
        return new constructors.InputPeerEmpty();
    }
    if (entity instanceof constructors.UserFull) {
        return getInputPeer(entity.user);
    }

    if (entity instanceof constructors.ChatFull) {
        return new constructors.InputPeerChat({ chatId: entity.id });
    }

    if (entity instanceof constructors.PeerChat) {
        return new constructors.InputPeerChat(entity.chatId);
    }

    _raiseCastFail(entity, 'InputPeer');
    return undefined;
}

/**
 Similar to :meth:`get_input_peer`, but for :tl:`InputChannel`'s alone.

 .. important::

 This method does not validate for invalid general-purpose access
 hashes, unlike `get_input_peer`. Consider using instead:
 ``get_input_channel(get_input_peer(channel))``.

 * @param entity
 * @returns {InputChannel|*}
 */
/* CONTEST
function getInputChannel(entity) {
    if (entity.SUBCLASS_OF_ID === undefined) {
        _raiseCastFail(entity, 'InputChannel')
    }

    if (entity.SUBCLASS_OF_ID === 0x40f202fd) { // crc32(b'InputChannel')
        return entity
    }
    if (entity instanceof constructors.Channel || entity instanceof constructors.ChannelForbidden) {
        return new constructors.InputChannel({
            channelId: entity.id,
            accessHash: entity.accessHash || 0
        })
    }

    if (entity instanceof constructors.InputPeerChannel) {
        return new constructors.InputChannel({
            channelId: entity.channelId,
            accessHash: entity.accessHash
        })
    }
    _raiseCastFail(entity, 'InputChannel')
}
*/
/**
 Similar to :meth:`get_input_peer`, but for :tl:`InputUser`'s alone.

 .. important::

 This method does not validate for invalid general-purpose access
 hashes, unlike `get_input_peer`. Consider using instead:
 ``get_input_channel(get_input_peer(channel))``.

 * @param entity
 */
/* CONTEST
function getInputUser(entity) {
    if (entity.SUBCLASS_OF_ID === undefined) {
        _raiseCastFail(entity, 'InputUser')
    }
    if (entity.SUBCLASS_OF_ID === 0xe669bf46) { // crc32(b'InputUser')
        return entity
    }

    if (entity instanceof constructors.User) {
        if (entity.isSelf) {
            return new constructors.InputPeerSelf()
        } else {
            return new constructors.InputUser({
                userId: entity.id,
                accessHash: entity.accessHash || 0,
            })
        }
    }
    if (entity instanceof constructors.InputPeerSelf) {
        return new constructors.InputPeerSelf()
    }
    if (entity instanceof constructors.UserEmpty || entity instanceof constructors.InputPeerEmpty) {
        return new constructors.InputUserEmpty()
    }

    if (entity instanceof constructors.UserFull) {
        return getInputUser(entity.user)
    }

    if (entity instanceof constructors.InputPeerUser) {
        return new constructors.InputUser({
            userId: entity.userId,
            accessHash: entity.accessHash
        })
    }

    _raiseCastFail(entity, 'InputUser')
}
*/
/**
 Similar to :meth:`get_input_peer`, but for dialogs
 * @param dialog
 */
/* CONTEST
function getInputDialog(dialog) {
    try {
        if (dialog.SUBCLASS_OF_ID === 0xa21c9795) { // crc32(b'InputDialogPeer')
            return dialog
        }
        if (dialog.SUBCLASS_OF_ID === 0xc91c90b6) { // crc32(b'InputPeer')
            return new constructors.InputDialogPeer({ peer: dialog })
        }
    } catch (e) {
        _raiseCastFail(dialog, 'InputDialogPeer')
    }

    try {
        return new constructors.InputDialogPeer(getInputPeer(dialog))
        // eslint-disable-next-line no-empty
    } catch (e) {

    }
    _raiseCastFail(dialog, 'InputDialogPeer')
}
*/

/* CONTEST

function getInputMessage(message) {
    try {
        if (typeof message == 'number') { // This case is really common too
            return new constructors.InputMessageID({
                id: message,
            })
        } else if (message.SUBCLASS_OF_ID === 0x54b6bcc5) { // crc32(b'InputMessage')
            return message
        } else if (message.SUBCLASS_OF_ID === 0x790009e3) { // crc32(b'Message')
            return new constructors.InputMessageID(message.id)
        }
        // eslint-disable-next-line no-empty
    } catch (e) {
    }

    _raiseCastFail(message, 'InputMessage')
}
*/

/**
 * Adds the JPG header and footer to a stripped image.
 * Ported from https://github.com/telegramdesktop/
 * tdesktop/blob/bec39d89e19670eb436dc794a8f20b657cb87c71/Telegram/SourceFiles/ui/image/image.cpp#L225

 * @param stripped{Buffer}
 * @returns {Buffer}
 */
function strippedPhotoToJpg(stripped) {
    // Note: Changes here should update _stripped_real_length
    if (stripped.length < 3 || stripped[0] !== 1) {
        return stripped;
    }
    const header = Buffer.from(JPEG_HEADER);
    // eslint-disable-next-line prefer-destructuring
    header[164] = stripped[1];
    // eslint-disable-next-line prefer-destructuring
    header[166] = stripped[2];
    return Buffer.concat([header, stripped.slice(3), JPEG_FOOTER]);
}

/* CONTEST
function getInputLocation(location) {
    try {
        if (!location.SUBCLASS_OF_ID) {
            throw new Error()
        }
        if (location.SUBCLASS_OF_ID === 0x1523d462) {
            return {
                dcId: null,
                inputLocation: location
            }
        }
    } catch (e) {
        _raiseCastFail(location, 'InputFileLocation')
    }
    if (location instanceof constructors.Message) {
        location = location.media
    }

    if (location instanceof constructors.MessageMediaDocument) {
        location = location.document
    } else if (location instanceof constructors.MessageMediaPhoto) {
        location = location.photo
    }

    if (location instanceof constructors.Document) {
        return {
            dcId: location.dcId,
            inputLocation: new constructors.InputDocumentFileLocation({
                id: location.id,
                accessHash: location.accessHash,
                fileReference: location.fileReference,
                thumbSize: '', // Presumably to download one of its thumbnails
            }),
        }
    } else if (location instanceof constructors.Photo) {
        return {
            dcId: location.dcId,
            inputLocation: new constructors.InputPhotoFileLocation({
                id: location.id,
                accessHash: location.accessHash,
                fileReference: location.fileReference,
                thumbSize: location.sizes[location.sizes.length - 1].type,
            }),
        }
    }

    if (location instanceof constructors.FileLocationToBeDeprecated) {
        throw new Error('Unavailable location cannot be used as input')
    }
    _raiseCastFail(location, 'InputFileLocation')
}
*/

/**
 * Gets the appropriated part size when downloading files,
 * given an initial file size.
 * @param fileSize
 * @returns {Number}
 */
function getDownloadPartSize(fileSize) {
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
function getUploadPartSize(fileSize) {
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

/* CONTEST
function getPeer(peer) {
    try {
        if (typeof peer === 'number') {
            const res = resolveId(peer)

            if (res[1] === constructors.PeerChannel) {
                return new res[1]({ channelId: res[0] })
            } else if (res[1] === constructors.PeerChat) {
                return new res[1]({ chatId: res[0] })
            } else {
                return new res[1]({ userId: res[0] })
            }
        }
        if (peer.SUBCLASS_OF_ID === undefined) {
            throw new Error()
        }
        if (peer.SUBCLASS_OF_ID === 0x2d45687) {
            return peer
        } else if (peer instanceof constructors.contacts.ResolvedPeer ||
            peer instanceof constructors.InputNotifyPeer || peer instanceof constructors.TopPeer ||
            peer instanceof constructors.Dialog || peer instanceof constructors.DialogPeer) {
            return peer.peer
        } else if (peer instanceof constructors.ChannelFull) {
            return new constructors.PeerChannel({ channelId: peer.id })
        }
        if (peer.SUBCLASS_OF_ID === 0x7d7c6f86 || peer.SUBCLASS_OF_ID === 0xd9c7fc18) {
            // ChatParticipant, ChannelParticipant
            return new constructors.PeerUser({ userId: peer.userId })
        }
        peer = getInputPeer(peer, false, false)

        if (peer instanceof constructors.InputPeerUser) {
            return new constructors.PeerUser({ userId: peer.userId })
        } else if (peer instanceof constructors.InputPeerChat) {
            return new constructors.PeerChat({ chatId: peer.chatId })
        } else if (peer instanceof constructors.InputPeerChannel) {
            return new constructors.PeerChannel({ channelId: peer.channelId })
        }
        // eslint-disable-next-line no-empty
    } catch (e) {
        console.log(e)
    }
    _raiseCastFail(peer, 'peer')
}
*/

/**
 Convert the given peer into its marked ID by default.

 This "mark" comes from the "bot api" format, and with it the peer type
 can be identified back. User ID is left unmodified, chat ID is negated,
 and channel ID is prefixed with -100:

 * ``userId``
 * ``-chatId``
 * ``-100channel_id``

 The original ID and the peer type class can be returned with
 a call to :meth:`resolve_id(marked_id)`.
 * @param peer
 * @param addMark
 */
/* CONTEST
function getPeerId(peer, addMark = true) {
    // First we assert it's a Peer TLObject, or early return for integers
    if (typeof peer == 'number') {
        return addMark ? peer : resolveId(peer)[0]
    }

    // Tell the user to use their client to resolve InputPeerSelf if we got one
    if (peer instanceof constructors.InputPeerSelf) {
        _raiseCastFail(peer, 'int (you might want to use client.get_peer_id)')
    }

    try {
        peer = getPeer(peer)
    } catch (e) {
        _raiseCastFail(peer, 'int')
    }
    if (peer instanceof constructors.PeerUser) {
        return peer.userId
    } else if (peer instanceof constructors.PeerChat) {
        // Check in case the user mixed things up to avoid blowing up
        if (!(0 < peer.chatId <= 0x7fffffff)) {
            peer.chatId = resolveId(peer.chatId)[0]
        }

        return addMark ? -(peer.chatId) : peer.chatId
    } else { // if (peer instanceof constructors.PeerChannel)
        // Check in case the user mixed things up to avoid blowing up
        if (!(0 < peer.channelId <= 0x7fffffff)) {
            peer.channelId = resolveId(peer.channelId)[0]
        }
        if (!addMark) {
            return peer.channelId
        }
        // Concat -100 through math tricks, .to_supergroup() on
        // Madeline IDs will be strictly positive -> log works.
        try {
            return -(peer.channelId + Math.pow(10, Math.floor(Math.log10(peer.channelId) + 3)))
        } catch (e) {
            throw new Error('Cannot get marked ID of a channel unless its ID is strictly positive')
        }
    }
}
*/
/**
 * Given a marked ID, returns the original ID and its :tl:`Peer` type.
 * @param markedId
 */
/* CONTEST
function resolveId(markedId) {
    if (markedId >= 0) {
        return [markedId, constructors.PeerUser]
    }

    // There have been report of chat IDs being 10000xyz, which means their
    // marked version is -10000xyz, which in turn looks like a channel but
    // it becomes 00xyz (= xyz). Hence, we must assert that there are only
    // two zeroes.
    const m = markedId.toString()
        .match(/-100([^0]\d*)/)
    if (m) {
        return [parseInt(m[1]), constructors.PeerChannel]
    }
    return [-markedId, constructors.PeerChat]
}
*/

/**
 * returns an entity pair
 * @param entityId
 * @param entities
 * @param cache
 * @param getInputPeer
 * @returns {{inputEntity: *, entity: *}}
 * @private
 */

/* CONTEST

function _getEntityPair(entityId, entities, cache, getInputPeer = getInputPeer) {
    const entity = entities.get(entityId)
    let inputEntity = cache[entityId]
    if (inputEntity === undefined) {
        try {
            inputEntity = getInputPeer(inputEntity)
        } catch (e) {
            inputEntity = null
        }
    }
    return {
        entity,
        inputEntity
    }
}
*/

function getMessageId(message) {
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
 Parses the given username or channel access hash, given
 a string, username or URL. Returns a tuple consisting of
 both the stripped, lowercase username and whether it is
 a joinchat/ hash (in which case is not lowercase'd).

 Returns ``(None, False)`` if the ``username`` or link is not valid.

 * @param username {string}
 */

/* CONTEST

function parseUsername(username) {
    username = username.trim()
    const m = username.match(USERNAME_RE) || username.match(TG_JOIN_RE)
    if (m) {
        username = username.replace(m[0], '')
        if (m[1]) {
            return {
                username: username,
                isInvite: true
            }
        } else {
            username = rtrim(username, '/')
        }
    }
    if (username.match(VALID_USERNAME_RE)) {
        return {
            username: username.toLowerCase(),
            isInvite: false
        }
    } else {
        return {
            username: null,
            isInvite: false
        }
    }
}

function rtrim(s, mask) {
    while (~mask.indexOf(s[s.length - 1])) {
        s = s.slice(0, -1)
    }
    return s
}

 */

/**
 * Gets the display name for the given :tl:`User`,
 :tl:`Chat` or :tl:`Channel`. Returns an empty string otherwise
 * @param entity
 */
function getDisplayName(entity) {
    if (entity instanceof constructors.User) {
        if (entity.lastName && entity.firstName) {
            return `${entity.firstName} ${entity.lastName}`;
        } else if (entity.firstName) {
            return entity.firstName;
        } else if (entity.lastName) {
            return entity.lastName;
        } else {
            return '';
        }
    } else if (entity instanceof constructors.Chat || entity instanceof constructors.Channel) {
        return entity.title;
    }
    return '';
}

/**
 * check if a given item is an array like or not
 * @param item
 * @returns {boolean}
 */

/* CONTEST
Duplicate ?
function isListLike(item) {
    return (
        Array.isArray(item) ||
        (Boolean(item) &&
            typeof item === 'object' &&
            typeof (item.length) === 'number' &&
            (item.length === 0 ||
                (item.length > 0 &&
                    (item.length - 1) in item)
            )
        )
    )
}
*/
/**
 * Returns the appropriate DC based on the id
 * @param dcId the id of the DC.
 * @param downloadDC whether to use -1 DCs or not
 * (These only support downloading/uploading and not creating a new AUTH key)
 * @return {{port: number, ipAddress: string, id: number}}
 */
function getDC(dcId, downloadDC = false) {
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

module.exports = {
    getMessageId,
    // _getEntityPair,
    // getInputMessage,
    // getInputDialog,
    // getInputUser,
    // getInputChannel,
    getInputPeer,
    // parsePhone,
    // parseUsername,
    // getPeer,
    // getPeerId,
    getDisplayName,
    // resolveId,
    // isListLike,
    getDownloadPartSize,
    getUploadPartSize,
    // getInputLocation,
    strippedPhotoToJpg,
    getDC,
};
