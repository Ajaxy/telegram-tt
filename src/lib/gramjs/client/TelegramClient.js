const os = require('os');
const Logger = require('../extensions/Logger');
const { sleep } = require('../Helpers');
const errors = require('../errors');
const MemorySession = require('../sessions/Memory');
const Helpers = require('../Helpers');
const utils = require('../Utils');
const Session = require('../sessions/Abstract');
const { LAYER } = require('../tl/AllTLObjects');
const {
    constructors,
    requests,
} = require('../tl');
const MTProtoSender = require('../network/MTProtoSender');
const { ConnectionTCPObfuscated } = require('../network/connection/TCPObfuscated');
const {
    authFlow,
    checkAuthorization,
} = require('./auth');
const { downloadFile } = require('./downloadFile');
const { uploadFile } = require('./uploadFile');
const { updateTwoFaSettings } = require('./2fa');

const DEFAULT_DC_ID = 2;
const WEBDOCUMENT_DC_ID = 4;
const DEFAULT_IPV4_IP = 'zws4.web.telegram.org';
const DEFAULT_IPV6_IP = '[2001:67c:4e8:f002::a]';
const BORROWED_SENDER_RELEASE_TIMEOUT = 30000; // 30 sec
const WEBDOCUMENT_REQUEST_PART_SIZE = 131072; // 128kb

const PING_INTERVAL = 3000; // 3 sec
const PING_TIMEOUT = 5000; // 5 sec
const PING_FAIL_ATTEMPTS = 3;
const PING_FAIL_INTERVAL = 100; // ms
const PING_DISCONNECT_DELAY = 60000; // 1 min

// All types
const sizeTypes = ['w', 'y', 'd', 'x', 'c', 'm', 'b', 'a', 's'];


class TelegramClient {
    static DEFAULT_OPTIONS = {
        connection: ConnectionTCPObfuscated,
        useIPV6: false,
        proxy: undefined,
        timeout: 10,
        requestRetries: 5,
        connectionRetries: Infinity,
        retryDelay: 1000,
        autoReconnect: true,
        sequentialUpdates: false,
        floodSleepLimit: 60,
        deviceModel: undefined,
        systemVersion: undefined,
        appVersion: undefined,
        langCode: 'en',
        systemLangCode: 'en',
        baseLogger: 'gramjs',
        useWSS: false,
        additionalDcsDisabled: false,
    };

    /**
     *
     * @param session {StringSession|LocalStorageSession}
     * @param apiId
     * @param apiHash
     * @param opts
     */
    constructor(session, apiId, apiHash, opts = TelegramClient.DEFAULT_OPTIONS) {
        if (apiId === undefined || apiHash === undefined) {
            throw Error('Your API ID or Hash are invalid. Please read "Requirements" on README.md');
        }
        const args = { ...TelegramClient.DEFAULT_OPTIONS, ...opts };
        this.apiId = apiId;
        this.apiHash = apiHash;
        this._useIPV6 = args.useIPV6;
        // this._entityCache = new Set()
        if (typeof args.baseLogger === 'string') {
            this._log = new Logger();
        } else {
            this._log = args.baseLogger;
        }
        // Determine what session we will use
        if (typeof session === 'string' || !session) {
            try {
                throw new Error('not implemented');
            } catch (e) {
                session = new MemorySession();
            }
        } else if (!(session instanceof Session)) {
            throw new Error('The given session must be str or a session instance');
        }

        this.floodSleepLimit = args.floodSleepLimit;
        this._eventBuilders = [];

        this._phoneCodeHash = {};
        this.session = session;
        // this._entityCache = EntityCache();
        this.apiId = parseInt(apiId, 10);
        this.apiHash = apiHash;

        this._requestRetries = args.requestRetries;
        this._connectionRetries = args.connectionRetries;
        this._retryDelay = args.retryDelay || 0;
        if (args.proxy) {
            this._log.warn('proxies are not supported');
        }
        this._proxy = args.proxy;
        this._timeout = args.timeout;
        this._autoReconnect = args.autoReconnect;

        this._connection = args.connection;
        // TODO add proxy support

        this._floodWaitedRequests = {};

        this._initWith = (x) => {
            return new requests.InvokeWithLayer({
                layer: LAYER,
                query: new requests.InitConnection({
                    apiId: this.apiId,
                    deviceModel: args.deviceModel || os.type()
                        .toString() || 'Unknown',
                    systemVersion: args.systemVersion || os.release()
                        .toString() || '1.0',
                    appVersion: args.appVersion || '1.0',
                    langCode: args.langCode,
                    langPack: '', // this should be left empty.
                    systemLangCode: args.systemLangCode,
                    query: x,
                    proxy: undefined, // no proxies yet.
                }),
            });
        };

        this._args = args;
        // These will be set later
        this._config = undefined;
        this.phoneCodeHashes = [];
        this._borrowedSenderPromises = {};
        this._borrowedSenderReleaseTimeouts = {};
        this._additionalDcsDisabled = args.additionalDcsDisabled;
    }


    // region Connecting

    /**
     * Connects to the Telegram servers, executing authentication if required.
     * Note that authenticating to the Telegram servers is not the same as authenticating
     * the app, which requires to send a code first.
     * @returns {Promise<void>}
     */
    async connect() {
        await this._initSession();

        this._sender = new MTProtoSender(this.session.getAuthKey(), {
            logger: this._log,
            dcId: this.session.dcId,
            retries: this._connectionRetries,
            delay: this._retryDelay,
            autoReconnect: this._autoReconnect,
            connectTimeout: this._timeout,
            authKeyCallback: this._authKeyCallback.bind(this),
            updateCallback: this._handleUpdate.bind(this),
            isMainSender: true,
        });

        const connection = new this._connection(
            this.session.serverAddress, this.session.port, this.session.dcId, this._log,
        );

        await this._sender.connect(connection);

        this.session.setAuthKey(this._sender.authKey);
        await this._sender.send(this._initWith(
            new requests.help.GetConfig({}),
        ));

        this._updateLoop();
    }

    async _initSession() {
        await this.session.load();

        if (!this.session.serverAddress || (this.session.serverAddress.includes(':') !== this._useIPV6)) {
            this.session.setDC(DEFAULT_DC_ID, this._useIPV6
                ? DEFAULT_IPV6_IP : DEFAULT_IPV4_IP, this._args.useWSS ? 443 : 80);
        }
    }

    async _updateLoop() {
        while (this.isConnected()) {
            await Helpers.sleep(PING_INTERVAL);

            try {
                await attempts(() => {
                    return timeout(this._sender.send(new requests.PingDelayDisconnect({
                        pingId: Helpers.getRandomInt(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
                        disconnectDelay: PING_DISCONNECT_DELAY,
                    })), PING_TIMEOUT);
                }, PING_FAIL_ATTEMPTS, PING_FAIL_INTERVAL);
            } catch (err) {
                // eslint-disable-next-line no-console
                console.warn(err);

                await this.disconnect();
                this.connect();

                return;
            }

            // We need to send some content-related request at least hourly
            // for Telegram to keep delivering updates, otherwise they will
            // just stop even if we're connected. Do so every 30 minutes.

            // TODO Call getDifference instead since it's more relevant
            if (new Date().getTime() - this._lastRequest > 30 * 60 * 1000) {
                try {
                    await this.invoke(new requests.updates.GetState());
                } catch (e) {
                    // we don't care about errors here
                }
            }
        }
    }

    /**
     * Disconnects from the Telegram server
     * @returns {Promise<void>}
     */
    async disconnect() {
        if (this._sender) {
            await this._sender.disconnect();
        }

        await Promise.all(
            Object.values(this._borrowedSenderPromises)
                .map((promise) => {
                    return promise && promise.then((sender) => {
                        if (sender) {
                            return sender.disconnect();
                        }
                        return undefined;
                    });
                }),
        );

        this._borrowedSenderPromises = {};
    }

    /**
     * Disconnects all senders and removes all handlers
     * @returns {Promise<void>}
     */
    async destroy() {
        try {
            await this.disconnect();
        } catch (err) {
            // Do nothing
        }

        this.session.delete();
        this._eventBuilders = [];
    }

    async _switchDC(newDc) {
        this._log.info(`Reconnecting to new data center ${newDc}`);
        const DC = utils.getDC(newDc);
        this.session.setDC(newDc, DC.ipAddress, DC.port);
        // authKey's are associated with a server, which has now changed
        // so it's not valid anymore. Set to None to force recreating it.
        await this._sender.authKey.setKey(undefined);
        this.session.setAuthKey(undefined);
        await this.disconnect();
        return this.connect();
    }

    _authKeyCallback(authKey, dcId) {
        this.session.setAuthKey(authKey, dcId);
    }

    // endregion
    // export region

    _cleanupBorrowedSender(dcId) {
        this._borrowedSenderPromises[dcId] = undefined;
    }

    _borrowExportedSender(dcId) {
        if (this._additionalDcsDisabled) {
            return undefined;
        }

        if (!this._borrowedSenderPromises[dcId]) {
            this._borrowedSenderPromises[dcId] = this._createExportedSender(dcId);
        }

        return this._borrowedSenderPromises[dcId].then((sender) => {
            if (!sender) {
                this._borrowedSenderPromises[dcId] = undefined;
                return this._borrowExportedSender(dcId);
            }

            if (this._borrowedSenderReleaseTimeouts[dcId]) {
                clearTimeout(this._borrowedSenderReleaseTimeouts[dcId]);
                this._borrowedSenderReleaseTimeouts[dcId] = undefined;
            }

            this._borrowedSenderReleaseTimeouts[dcId] = setTimeout(() => {
                this._borrowedSenderReleaseTimeouts[dcId] = undefined;
                this._borrowedSenderPromises[dcId] = undefined;

                // eslint-disable-next-line no-console
                console.warn(`Disconnecting from file socket #${dcId}...`);
                sender.disconnect();
            }, BORROWED_SENDER_RELEASE_TIMEOUT);

            return sender;
        });
    }

    async _createExportedSender(dcId) {
        const dc = utils.getDC(dcId);
        const sender = new MTProtoSender(this.session.getAuthKey(dcId),
            {
                logger: this._log,
                dcId,
                retries: this._connectionRetries,
                delay: this._retryDelay,
                autoReconnect: this._autoReconnect,
                connectTimeout: this._timeout,
                authKeyCallback: this._authKeyCallback.bind(this),
                isMainSender: dcId === this.session.dcId,
                onConnectionBreak: this._cleanupBorrowedSender.bind(this),
            });
        for (let i = 0; i < 5; i++) {
            try {
                await sender.connect(new this._connection(
                    dc.ipAddress,
                    dc.port,
                    dcId,
                    this._log,
                ));
                if (this.session.dcId !== dcId) {
                    this._log.info(`Exporting authorization for data center ${dc.ipAddress}`);
                    const auth = await this.invoke(new requests.auth.ExportAuthorization({ dcId }));
                    const req = this._initWith(new requests.auth.ImportAuthorization({
                        id: auth.id,
                        bytes: auth.bytes,
                    }));
                    await sender.send(req);
                }
                sender.dcId = dcId;
                return sender;
            } catch (e) {
                await sender.disconnect();
            }
        }
        return undefined;
    }

    // end region

    // download region

    /**
     * Complete flow to download a file.
     * @param inputLocation {constructors.InputFileLocation}
     * @param [args[partSizeKb] {number}]
     * @param [args[fileSize] {number}]
     * @param [args[progressCallback] {Function}]
     * @param [args[start] {number}]
     * @param [args[end] {number}]
     * @param [args[dcId] {number}]
     * @param [args[workers] {number}]
     * @returns {Promise<Buffer>}
     */
    downloadFile(inputLocation, args = {}) {
        return downloadFile(this, inputLocation, args);
    }

    downloadMedia(messageOrMedia, args) {
        let media;
        if (messageOrMedia instanceof constructors.Message) {
            media = messageOrMedia.media;
        } else {
            media = messageOrMedia;
        }
        if (typeof media === 'string') {
            throw new Error('not implemented');
        }

        if (media instanceof constructors.MessageMediaWebPage) {
            if (media.webpage instanceof constructors.WebPage) {
                media = media.webpage.document || media.webpage.photo;
            }
        }
        if (media instanceof constructors.MessageMediaPhoto || media instanceof constructors.Photo) {
            return this._downloadPhoto(media, args);
        } else if (media instanceof constructors.MessageMediaDocument || media instanceof constructors.Document) {
            return this._downloadDocument(media, args);
        } else if (media instanceof constructors.MessageMediaContact) {
            return this._downloadContact(media, args);
        } else if (media instanceof constructors.WebDocument || media instanceof constructors.WebDocumentNoProxy) {
            return this._downloadWebDocument(media, args);
        }
        return undefined;
    }

    downloadProfilePhoto(entity, isBig = false) {
        // ('User', 'Chat', 'UserFull', 'ChatFull')
        const ENTITIES = [0x2da17977, 0xc5af5d94, 0x1f4661b9, 0xd49a2697];
        // ('InputPeer', 'InputUser', 'InputChannel')
        // const INPUTS = [0xc91c90b6, 0xe669bf46, 0x40f202fd]
        // Todo account for input methods
        const sizeType = isBig ? 'x' : 'm';
        let photo;
        if (!(ENTITIES.includes(entity.SUBCLASS_OF_ID))) {
            photo = entity;
        } else {
            if (!entity.photo) {
                // Special case: may be a ChatFull with photo:Photo
                if (!entity.chatPhoto) {
                    return undefined;
                }

                return this._downloadPhoto(
                    entity.chatPhoto, { sizeType },
                );
            }
            photo = entity.photo;
        }

        let dcId;
        let loc;
        if (photo instanceof constructors.UserProfilePhoto || photo instanceof constructors.ChatPhoto) {
            dcId = photo.dcId;
            loc = new constructors.InputPeerPhotoFileLocation({
                peer: utils.getInputPeer(entity),
                photoId: photo.photoId,
                big: isBig,
            });
        } else {
            // It doesn't make any sense to check if `photo` can be used
            // as input location, because then this method would be able
            // to "download the profile photo of a message", i.e. its
            // media which should be done with `download_media` instead.
            return undefined;
        }
        return this.downloadFile(loc, {
            dcId,
        });
    }

    downloadStickerSetThumb(stickerSet) {
        if (!stickerSet.thumbs || !stickerSet.thumbs.length) {
            return undefined;
        }

        const { thumbVersion } = stickerSet;
        return this.downloadFile(
            new constructors.InputStickerSetThumb({
                stickerset: new constructors.InputStickerSetID({
                    id: stickerSet.id,
                    accessHash: stickerSet.accessHash,
                }),
                thumbVersion,
            }),
            { dcId: stickerSet.thumbDcId },
        );
    }

    _pickFileSize(sizes, sizeType) {
        if (!sizeType || !sizes || !sizes.length) {
            return undefined;
        }
        const indexOfSize = sizeTypes.indexOf(sizeType);
        let size;
        for (let i = indexOfSize; i < sizeTypes.length; i++) {
            size = sizes.find((s) => s.type === sizeTypes[i]);
            if (size) {
                return size;
            }
        }
        return undefined;
    }


    _downloadCachedPhotoSize(size) {
        // No need to download anything, simply write the bytes
        let data;
        if (size instanceof constructors.PhotoStrippedSize) {
            data = utils.strippedPhotoToJpg(size.bytes);
        } else {
            data = size.bytes;
        }
        return data;
    }

    _downloadPhoto(photo, args) {
        if (photo instanceof constructors.MessageMediaPhoto) {
            photo = photo.photo;
        }
        if (!(photo instanceof constructors.Photo)) {
            return undefined;
        }
        const size = this._pickFileSize(photo.sizes, args.sizeType);
        if (!size || (size instanceof constructors.PhotoSizeEmpty)) {
            return undefined;
        }

        if (size instanceof constructors.PhotoCachedSize || size instanceof constructors.PhotoStrippedSize) {
            return this._downloadCachedPhotoSize(size);
        }
        return this.downloadFile(
            new constructors.InputPhotoFileLocation({
                id: photo.id,
                accessHash: photo.accessHash,
                fileReference: photo.fileReference,
                thumbSize: size.type,
            }),
            {
                dcId: photo.dcId,
                fileSize: size.size,
                progressCallback: args.progressCallback,
            },
        );
    }

    _downloadDocument(doc, args) {
        if (doc instanceof constructors.MessageMediaDocument) {
            doc = doc.document;
        }
        if (!(doc instanceof constructors.Document)) {
            return undefined;
        }

        let size;
        if (args.sizeType) {
            size = doc.thumbs ? this._pickFileSize(doc.thumbs, args.sizeType) : undefined;
            if (!size && doc.mimeType.startsWith('video/')) {
                return undefined;
            }

            if (size && (size instanceof constructors.PhotoCachedSize
                || size instanceof constructors.PhotoStrippedSize)) {
                return this._downloadCachedPhotoSize(size);
            }
        }

        return this.downloadFile(
            new constructors.InputDocumentFileLocation({
                id: doc.id,
                accessHash: doc.accessHash,
                fileReference: doc.fileReference,
                thumbSize: size ? size.type : '',
            }),
            {
                fileSize: size ? size.size : doc.size,
                progressCallback: args.progressCallback,
                start: args.start,
                end: args.end,
                dcId: doc.dcId,
                workers: args.workers,
            },
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _downloadContact(media, args) {
        throw new Error('not implemented');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async _downloadWebDocument(media) {
        try {
            const buff = [];
            let offset = 0;
            while (true) {
                const downloaded = new requests.upload.GetWebFile({
                    location: new constructors.InputWebFileLocation({
                        url: media.url,
                        accessHash: media.accessHash,
                    }),
                    offset,
                    limit: WEBDOCUMENT_REQUEST_PART_SIZE,
                });
                const sender = await this._borrowExportedSender(WEBDOCUMENT_DC_ID);
                const res = await sender.send(downloaded);
                offset += 131072;
                if (res.bytes.length) {
                    buff.push(res.bytes);
                    if (res.bytes.length < WEBDOCUMENT_REQUEST_PART_SIZE) {
                        break;
                    }
                } else {
                    break;
                }
            }
            return Buffer.concat(buff);
        } catch (e) {
            // the file is no longer saved in telegram's cache.
            if (e.message === 'WEBFILE_NOT_AVAILABLE') {
                return Buffer.alloc(0);
            } else {
                throw e;
            }
        }
    }
    // region Invoking Telegram request
    /**
     * Invokes a MTProtoRequest (sends and receives it) and returns its result
     * @param request
     * @returns {Promise}
     */

    async invoke(request) {
        if (request.classType !== 'request') {
            throw new Error('You can only invoke MTProtoRequests');
        }
        // This causes issues for now because not enough utils
        // await request.resolve(this, utils)


        this._lastRequest = new Date().getTime();
        let attempt = 0;
        for (attempt = 0; attempt < this._requestRetries; attempt++) {
            const promise = this._sender.sendWithInvokeSupport(request);
            try {
                const result = await promise.promise;
                return result;
            } catch (e) {
                if (e instanceof errors.ServerError || e.message === 'RPC_CALL_FAIL'
                    || e.message === 'RPC_MCGET_FAIL') {
                    this._log.warn(`Telegram is having internal issues ${e.constructor.name}`);
                    await sleep(2000);
                } else if (e instanceof errors.FloodWaitError || e instanceof errors.FloodTestPhoneWaitError) {
                    if (e.seconds <= this.floodSleepLimit) {
                        this._log.info(`Sleeping for ${e.seconds}s on flood wait`);
                        await sleep(e.seconds * 1000);
                    } else {
                        throw e;
                    }
                } else if (e instanceof errors.PhoneMigrateError || e instanceof errors.NetworkMigrateError
                    || e instanceof errors.UserMigrateError) {
                    this._log.info(`Phone migrated to ${e.newDc}`);
                    const shouldRaise = e instanceof errors.PhoneMigrateError
                        || e instanceof errors.NetworkMigrateError;
                    if (shouldRaise && await checkAuthorization(this)) {
                        throw e;
                    }
                    await this._switchDC(e.newDc);
                } else if (e instanceof errors.MsgWaitError) {
                    // we need to resend this after the old one was confirmed.
                    await promise.isReady();
                } else {
                    throw e;
                }
            }
        }
        throw new Error(`Request was unsuccessful ${attempt} time(s)`);
    }

    async getMe() {
        try {
            return (await this.invoke(new requests.users
                .GetUsers({ id: [new constructors.InputUserSelf()] })))[0];
        } catch (e) {
            this._log.warn('error while getting me');
            this._log.warn(e);
        }
        return undefined;
    }

    async start(authParams) {
        if (!this.isConnected()) {
            await this.connect();
        }

        if (await checkAuthorization(this)) {
            return;
        }

        const apiCredentials = {
            apiId: this.apiId,
            apiHash: this.apiHash,
        };

        await authFlow(this, apiCredentials, authParams);
    }

    uploadFile(fileParams) {
        return uploadFile(this, fileParams);
    }

    updateTwoFaSettings(params) {
        return updateTwoFaSettings(this, params);
    }

    // event region
    addEventHandler(callback, event) {
        this._eventBuilders.push([event, callback]);
    }

    _handleUpdate(update) {
        // this.session.processEntities(update)
        // this._entityCache.add(update)

        if (update instanceof constructors.Updates || update instanceof constructors.UpdatesCombined) {
            // TODO deal with entities
            const entities = [];
            for (const x of [...update.users, ...update.chats]) {
                entities.push(x);
            }
            for (const u of update.updates) {
                this._processUpdate(u, update.updates, entities);
            }
        } else if (update instanceof constructors.UpdateShort) {
            this._processUpdate(update.update, undefined);
        } else {
            this._processUpdate(update, undefined);
        }
        // TODO add caching
        // this._stateCache.update(update)
    }

    _processUpdate(update, others, entities) {
        update._entities = entities || [];
        const args = {
            update,
            others,
        };
        this._dispatchUpdate(args);
    }


    // endregion

    // region private methods

    /**
     Gets a full entity from the given string, which may be a phone or
     a username, and processes all the found entities on the session.
     The string may also be a user link, or a channel/chat invite link.

     This method has the side effect of adding the found users to the
     session database, so it can be queried later without API calls,
     if this option is enabled on the session.

     Returns the found entity, or raises TypeError if not found.
     * @param string {string}
     * @returns {Promise<void>}
     * @private
     */
    /* CONTEST
    async _getEntityFromString(string) {
        const phone = utils.parsePhone(string)
        if (phone) {
            try {
                for (const user of (await this.invoke(
                    new requests.contacts.GetContacts(0))).users) {
                    if (user.phone === phone) {
                        return user
                    }
                }
            } catch (e) {
                if (e.message === 'BOT_METHOD_INVALID') {
                    throw new Error('Cannot get entity by phone number as a ' +
                        'bot (try using integer IDs, not strings)')
                }
                throw e
            }
        } else if (['me', 'this'].includes(string.toLowerCase())) {
            return this.getMe()
        } else {
            const { username, isJoinChat } = utils.parseUsername(string)
            if (isJoinChat) {
                const invite = await this.invoke(new requests.messages.CheckChatInvite({
                    'hash': username,
                }))
                if (invite instanceof constructors.ChatInvite) {
                    throw new Error('Cannot get entity from a channel (or group) ' +
                        'that you are not part of. Join the group and retry',
                    )
                } else if (invite instanceof constructors.ChatInviteAlready) {
                    return invite.chat
                }
            } else if (username) {
                try {
                    const result = await this.invoke(
                        new requests.contacts.ResolveUsername(username))
                    const pid = utils.getPeerId(result.peer, false)
                    if (result.peer instanceof constructors.PeerUser) {
                        for (const x of result.users) {
                            if (x.id === pid) {
                                return x
                            }
                        }
                    } else {
                        for (const x of result.chats) {
                            if (x.id === pid) {
                                return x
                            }
                        }
                    }
                } catch (e) {
                    if (e.message === 'USERNAME_NOT_OCCUPIED') {
                        throw new Error(`No user has "${username}" as username`)
                    }
                    throw e
                }
            }
        }
        throw new Error(`Cannot find any entity corresponding to "${string}"`)
    }
    */
    // endregion


    // users region
    /**
     Turns the given entity into its input entity version.

     Most requests use this kind of :tl:`InputPeer`, so this is the most
     suitable call to make for those cases. **Generally you should let the
     library do its job** and don't worry about getting the input entity
     first, but if you're going to use an entity often, consider making the
     call:

     Arguments
     entity (`str` | `int` | :tl:`Peer` | :tl:`InputPeer`):
     If a username or invite link is given, **the library will
     use the cache**. This means that it's possible to be using
     a username that *changed* or an old invite link (this only
     happens if an invite link for a small group chat is used
     after it was upgraded to a mega-group).

     If the username or ID from the invite link is not found in
     the cache, it will be fetched. The same rules apply to phone
     numbers (``'+34 123456789'``) from people in your contact list.

     If an exact name is given, it must be in the cache too. This
     is not reliable as different people can share the same name
     and which entity is returned is arbitrary, and should be used
     only for quick tests.

     If a positive integer ID is given, the entity will be searched
     in cached users, chats or channels, without making any call.

     If a negative integer ID is given, the entity will be searched
     exactly as either a chat (prefixed with ``-``) or as a channel
     (prefixed with ``-100``).

     If a :tl:`Peer` is given, it will be searched exactly in the
     cache as either a user, chat or channel.

     If the given object can be turned into an input entity directly,
     said operation will be done.

     Unsupported types will raise ``TypeError``.

     If the entity can't be found, ``ValueError`` will be raised.

     Returns
     :tl:`InputPeerUser`, :tl:`InputPeerChat` or :tl:`InputPeerChannel`
     or :tl:`InputPeerSelf` if the parameter is ``'me'`` or ``'self'``.

     If you need to get the ID of yourself, you should use
     `get_me` with ``input_peer=True``) instead.

     Example
     .. code-block:: python

     // If you're going to use "username" often in your code
     // (make a lot of calls), consider getting its input entity
     // once, and then using the "user" everywhere instead.
     user = await client.get_input_entity('username')

     // The same applies to IDs, chats or channels.
     chat = await client.get_input_entity(-123456789)

     * @param peer
     * @returns {Promise<>}
     */

    /* CONTEST
    async getInputEntity(peer) {
        // Short-circuit if the input parameter directly maps to an InputPeer
        try {
            return utils.getInputPeer(peer)
            // eslint-disable-next-line no-empty
        } catch (e) {
        }
        // Next in priority is having a peer (or its ID) cached in-memory
        try {
            // 0x2d45687 == crc32(b'Peer')
            if (typeof peer === 'number' || peer.SUBCLASS_OF_ID === 0x2d45687) {
                if (this._entityCache.has(peer)) {
                    return this._entityCache[peer]
                }
            }
            // eslint-disable-next-line no-empty
        } catch (e) {
        }
        // Then come known strings that take precedence
        if (['me', 'this'].includes(peer)) {
            return new constructors.InputPeerSelf()
        }
        // No InputPeer, cached peer, or known string. Fetch from disk cache
        try {
            return this.session.getInputEntity(peer)
            // eslint-disable-next-line no-empty
        } catch (e) {
        }
        // Only network left to try
        if (typeof peer === 'string') {
            return utils.getInputPeer(await this._getEntityFromString(peer))
        }
        // If we're a bot and the user has messaged us privately users.getUsers
        // will work with accessHash = 0. Similar for channels.getChannels.
        // If we're not a bot but the user is in our contacts, it seems to work
        // regardless. These are the only two special-cased requests.
        peer = utils.getPeer(peer)
        if (peer instanceof constructors.PeerUser) {
            const users = await this.invoke(new requests.users.GetUsers({
                id: [new constructors.InputUser({
                    userId: peer.userId,
                    accessHash: 0,
                })],
            }))
            if (users && !(users[0] instanceof constructors.UserEmpty)) {
                // If the user passed a valid ID they expect to work for
                // channels but would be valid for users, we get UserEmpty.
                // Avoid returning the invalid empty input peer for that.
                //
                // We *could* try to guess if it's a channel first, and if
                // it's not, work as a chat and try to validate it through
                // another request, but that becomes too much work.
                return utils.getInputPeer(users[0])
            }
        } else if (peer instanceof constructors.PeerChat) {
            return new constructors.InputPeerChat({
                chatId: peer.chatId,
            })
        } else if (peer instanceof constructors.PeerChannel) {
            try {
                const channels = await this.invoke(new requests.channels.GetChannels({
                    id: [new constructors.InputChannel({
                        channelId: peer.channelId,
                        accessHash: 0,
                    })],
                }))

                return utils.getInputPeer(channels.chats[0])
                // eslint-disable-next-line no-empty
            } catch (e) {
                console.log(e)
            }
        }
        throw new Error(`Could not find the input entity for ${peer.id || peer.channelId || peer.chatId || peer.userId}.
         Please read https://` +
            'docs.telethon.dev/en/latest/concepts/entities.html to' +
            ' find out more details.',
        )
    }
    */
    async _dispatchUpdate(args = {
        update: undefined,
        others: undefined,
        channelId: undefined,
        ptsDate: undefined,
    }) {
        for (const [builder, callback] of this._eventBuilders) {
            const event = builder.build(args.update);
            if (event) {
                await callback(event);
            }
        }
    }

    isConnected() {
        if (this._sender) {
            if (this._sender.isConnected()) {
                return true;
            }
        }
        return false;
    }
}

function timeout(promise, ms) {
    return Promise.race([
        promise,
        Helpers.sleep(ms)
            .then(() => Promise.reject(new Error('TIMEOUT'))),
    ]);
}

async function attempts(cb, times, pause) {
    for (let i = 0; i < times; i++) {
        try {
            // We need to `return await` here so it can be caught locally
            return await cb();
        } catch (err) {
            if (i === times - 1) {
                throw err;
            }

            await Helpers.sleep(pause);
        }
    }
    return undefined;
}

module.exports = TelegramClient;
