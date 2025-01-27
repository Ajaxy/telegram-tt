import os from 'os';
import bigInt from 'big-integer';
import { Logger } from '../extensions';
import { getRandomInt, sleep } from '../Helpers';
import MemorySession from '../sessions/Memory';
import Session from '../sessions/Abstract';
import { LAYER } from '../tl/AllTLObjects';
import { Api } from '../tl';
import {
    ConnectionTCPObfuscated,
    MTProtoSender,
    UpdateConnectionState,
    HttpConnection,
    Connection,
    UpdateServerTimeOffset,
} from '../network';
import { UserAuthParams, authFlow, checkAuthorization } from './auth';
import { DownloadFileParams, DownloadFileWithDcParams, DownloadMediaParams, downloadFile } from './downloadFile';
import { UploadFileParams, uploadFile } from './uploadFile';
import {
    updateTwoFaSettings,
    getTmpPassword,
    getCurrentPassword,
    TwoFaParams,
    TmpPasswordResult,
    PasswordResult,
} from './2fa';
import RequestState from '../network/RequestState';
import Deferred from '../../../util/Deferred';
import { getDC, getInputPeer, strippedPhotoToJpg } from '../Utils';
import { AuthKey } from '../crypto/AuthKey';
import {
    FloodTestPhoneWaitError,
    FloodWaitError,
    MsgWaitError,
    NetworkMigrateError,
    PhoneMigrateError,
    RPCError,
    ServerError,
    TimedOutError,
    UserMigrateError,
} from '../errors';
import { UpdatePts } from '../../../api/gramjs/updates/UpdatePts';
import LocalUpdatePremiumFloodWait from '../../../api/gramjs/updates/UpdatePremiumFloodWait';

type TelegramClientParams = {
    connection: typeof Connection;
    fallbackConnection: typeof Connection;
    useIPV6: boolean;
    timeout: number;
    requestRetries: number;
    connectionRetries: number;
    connectionRetriesToFallback: number;
    retryDelay: number;
    retryMainConnectionDelay: number;
    autoReconnect: boolean;
    sequentialUpdates: boolean;
    floodSleepLimit: number;
    deviceModel: string;
    systemVersion: string;
    appVersion: string;
    langCode: string;
    langPack: string;
    systemLangCode: string;
    baseLogger: string | Logger;
    useWSS: boolean;
    additionalDcsDisabled: boolean;
    dcId: number;
    isTestServerRequested: boolean;
    shouldAllowHttpTransport: boolean;
    shouldForceHttpTransport: boolean;
    shouldDebugExportedSenders: boolean;
};

type TimeoutId = ReturnType<typeof setTimeout>;

export type Update = (
    Api.TypeUpdate | Api.TypeUpdates
    | UpdateServerTimeOffset | UpdateConnectionState | UpdatePts | LocalUpdatePremiumFloodWait
) & { _entities?: (Api.TypeUser | Api.TypeChat)[] };
type EventBuilder = {
    build: (update: Update) => Update;
}

const DEFAULT_DC_ID = 2;
const DEFAULT_WEBDOCUMENT_DC_ID = 4;
const EXPORTED_SENDER_RECONNECT_TIMEOUT = 1000; // 1 sec
const EXPORTED_SENDER_RELEASE_TIMEOUT = 30000; // 30 sec
const WEBDOCUMENT_REQUEST_PART_SIZE = 131072; // 128kb

const PING_INTERVAL = 3000; // 3 sec
const PING_TIMEOUT = 5000; // 5 sec
const PING_FAIL_ATTEMPTS = 3;
const PING_FAIL_INTERVAL = 100; // ms

// An unusually long interval is a sign of returning from background mode...
const PING_INTERVAL_TO_WAKE_UP = 5000; // 5 sec
// ... so we send a quick "wake-up" ping to confirm than connection was dropped ASAP
const PING_WAKE_UP_TIMEOUT = 3000; // 3 sec
// We also send a warning to the user even a bit more quickly
const PING_WAKE_UP_WARNING_TIMEOUT = 1000; // 1 sec

const PING_DISCONNECT_DELAY = 60000; // 1 min

// All types, sorted by size
const sizeTypes = ['u', 'v', 'w', 'y', 'd', 'x', 'c', 'm', 'b', 'a', 's', 'f', 'i', 'j'] as const;
export type SizeType = typeof sizeTypes[number];

class TelegramClient {
    static DEFAULT_OPTIONS: Partial<TelegramClientParams> = {
        connection: ConnectionTCPObfuscated,
        fallbackConnection: HttpConnection,
        useIPV6: false,
        timeout: 10,
        requestRetries: 5,
        connectionRetries: Infinity,
        connectionRetriesToFallback: 1,
        retryDelay: 1000,
        retryMainConnectionDelay: 10000,
        autoReconnect: true,
        sequentialUpdates: false,
        floodSleepLimit: 60,
        deviceModel: undefined,
        systemVersion: undefined,
        appVersion: undefined,
        langCode: 'en',
        langPack: 'weba',
        systemLangCode: 'en',
        baseLogger: 'gramjs',
        useWSS: false,
        additionalDcsDisabled: false,
        dcId: DEFAULT_DC_ID,
        isTestServerRequested: false,
        shouldAllowHttpTransport: false,
        shouldForceHttpTransport: false,
        shouldDebugExportedSenders: false,
    };

    private _args: TelegramClientParams;

    public session: Session;

    public apiHash: string;

    public apiId: number;

    public defaultDcId: number;

    private _useIPV6: boolean;

    private _shouldForceHttpTransport: boolean;

    private _shouldAllowHttpTransport: boolean;

    private _shouldDebugExportedSenders: boolean;

    _log: Logger;

    private floodSleepLimit: number;

    private _connection: typeof Connection;

    private _fallbackConnection: typeof Connection;

    private _sender?: MTProtoSender;

    private _eventBuilders: [EventBuilder, CallableFunction][];

    private _requestRetries: number;

    private _connectionRetries: number;

    private _connectionRetriesToFallback: number;

    private _retryDelay: number;

    private _retryMainConnectionDelay: number;

    private _timeout: number;

    private _autoReconnect: boolean;

    private _config?: Api.Config;

    private _exportedSenderPromises: Record<number, Record<number, Promise<MTProtoSender> | undefined>> = {};
    private _exportedSenderRefCounter: Record<number, Record<number, number>> = {};
    private _waitingForAuthKey: Record<number, Promise<void> | undefined> = {};
    private _exportedSenderReleaseTimeouts: Record<number, Record<number, TimeoutId | undefined>> = {};
    private _loopStarted = false;
    private _isSwitchingDc = false;
    private _destroyed = false;
    private _connectedDeferred = new Deferred();
    private pingCallback?: () => Promise<void>;

    private _initWith: (x: unknown) => Api.InvokeWithLayer;

    isPremium = false;
    private _lastRequest = Date.now();

    constructor(
        session: Session,
        apiId?: number,
        apiHash?: string,
        opts: Partial<TelegramClientParams> = TelegramClient.DEFAULT_OPTIONS,
    ) {
        if (!apiId || !apiHash || !Number.isFinite(apiId)) {
            throw Error('Your API ID or Hash are invalid. Please read "Requirements" on README.md');
        }
        const args = { ...TelegramClient.DEFAULT_OPTIONS, ...opts } as TelegramClientParams;
        this.apiId = apiId;
        this.apiHash = apiHash;
        this.defaultDcId = args.dcId || DEFAULT_DC_ID;
        this._useIPV6 = args.useIPV6;
        this._shouldForceHttpTransport = args.shouldForceHttpTransport;
        this._shouldAllowHttpTransport = args.shouldAllowHttpTransport;
        this._shouldDebugExportedSenders = args.shouldDebugExportedSenders;
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
            } catch (e: unknown) {
                session = new MemorySession();
            }
        } else if (!(session instanceof Session)) {
            throw new Error('The given session must be str or a session instance');
        }
        this.session = session;

        this.floodSleepLimit = args.floodSleepLimit;
        this._eventBuilders = [];

        this._requestRetries = args.requestRetries;
        this._connectionRetries = args.connectionRetries;
        this._connectionRetriesToFallback = args.connectionRetriesToFallback;
        this._retryDelay = args.retryDelay || 0;
        this._retryMainConnectionDelay = args.retryMainConnectionDelay || 0;

        this._timeout = args.timeout;
        this._autoReconnect = args.autoReconnect;

        this._connection = args.connection;
        this._fallbackConnection = args.fallbackConnection;
        // TODO add proxy support

        this._initWith = (x: unknown) => {
            return new Api.InvokeWithLayer({
                layer: LAYER,
                query: new Api.InitConnection({
                    apiId: this.apiId,
                    deviceModel: args.deviceModel || os.type()
                        .toString() || 'Unknown',
                    systemVersion: args.systemVersion || os.release()
                        .toString() || '1.0',
                    appVersion: args.appVersion || '1.0',
                    langCode: args.langCode,
                    langPack: args.langPack,
                    systemLangCode: args.systemLangCode,
                    query: x,
                    proxy: undefined, // no proxies yet.
                }),
            });
        };

        this._args = args;
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

        if (this._sender === undefined) {
            // only init sender once to avoid multiple loops.
            this._sender = new MTProtoSender(this.session.getAuthKey(), {
                logger: this._log,
                dcId: this.session.dcId,
                retries: this._connectionRetries,
                retriesToFallback: this._connectionRetriesToFallback,
                shouldForceHttpTransport: this._shouldForceHttpTransport,
                shouldAllowHttpTransport: this._shouldAllowHttpTransport,
                delay: this._retryDelay,
                retryMainConnectionDelay: this._retryMainConnectionDelay,
                autoReconnect: this._autoReconnect,
                connectTimeout: this._timeout,
                authKeyCallback: this._authKeyCallback.bind(this),
                updateCallback: this._handleUpdate.bind(this),
                getShouldDebugExportedSenders: this.getShouldDebugExportedSenders.bind(this),
                isMainSender: true,
            });
        }

        const connection = new this._connection({
            ip: this.session.serverAddress,
            port: this.session.port,
            dcId: this.session.dcId,
            loggers: this._log,
            isTestServer: this.session.isTestServer,
        });
        const fallbackConnection = new this._fallbackConnection({
            ip: this.session.serverAddress,
            port: this.session.port,
            dcId: this.session.dcId,
            loggers: this._log,
            isTestServer: this.session.isTestServer,
        });

        const newConnection = await this._sender.connect(connection, false, fallbackConnection);
        if (!newConnection) {
            // we're already connected so no need to reset auth key.
            if (!this._loopStarted) {
                this._updateLoop();
                this._loopStarted = true;
            }
            return;
        }

        this.session.setAuthKey(this._sender.authKey);
        await this._sender.send(this._initWith(
            new Api.help.GetConfig(),
        ));

        if (!this._loopStarted) {
            this._updateLoop();
            this._loopStarted = true;
        }
        this._connectedDeferred.resolve();
        this._isSwitchingDc = false;

        // Prepare file connection on current DC to speed up initial media loading
        const mediaSender = await this._borrowExportedSender(this.session.dcId, false, undefined, 0, this.isPremium);
        if (mediaSender) this.releaseExportedSender(mediaSender);
    }

    async _initSession() {
        await this.session.load();

        if (!this.session.serverAddress || (this.session.serverAddress.includes(':') !== this._useIPV6)) {
            const DC = getDC(this.defaultDcId);
            // TODO Fill IP addresses for when `this._useIPV6` is used
            this.session.setDC(
                this.defaultDcId, DC.ipAddress, this._args.useWSS ? 443 : 80, this._args.isTestServerRequested,
            );
        }
    }

    setPingCallback(callback: () => Promise<void>) {
        this.pingCallback = callback;
    }

    async setForceHttpTransport(forceHttpTransport: boolean) {
        this._shouldForceHttpTransport = forceHttpTransport;
        await this.disconnect();
        this._sender = undefined;
        await this.connect();
    }

    async setAllowHttpTransport(allowHttpTransport: boolean) {
        this._shouldAllowHttpTransport = allowHttpTransport;
        await this.disconnect();
        this._sender = undefined;
        await this.connect();
    }

    setShouldDebugExportedSenders(shouldDebugExportedSenders: boolean) {
        this._shouldDebugExportedSenders = shouldDebugExportedSenders;
    }

    getShouldDebugExportedSenders() {
        return this._shouldDebugExportedSenders;
    }

    async _updateLoop() {
        let lastPongAt;

        const sender = this._sender;
        if (!sender) {
            throw new Error('Sender is not initialized');
        }

        while (!this._destroyed) {
            await sleep(PING_INTERVAL);
            if (sender.isReconnecting || this._isSwitchingDc) {
                lastPongAt = undefined;
                continue;
            }

            try {
                const ping = () => {
                    if (this._destroyed) {
                        return undefined;
                    }
                    return sender.send(new Api.PingDelayDisconnect({
                        pingId: bigInt(getRandomInt(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)),
                        disconnectDelay: PING_DISCONNECT_DELAY,
                    }));
                };

                const pingAt = Date.now();
                const lastInterval = lastPongAt ? pingAt - lastPongAt : undefined;

                if (!lastInterval || lastInterval < PING_INTERVAL_TO_WAKE_UP) {
                    await attempts(() => timeout(ping, PING_TIMEOUT), PING_FAIL_ATTEMPTS, PING_FAIL_INTERVAL);
                } else {
                    let wakeUpWarningTimeout: TimeoutId | undefined = setTimeout(() => {
                        this._handleUpdate(new UpdateConnectionState(UpdateConnectionState.disconnected));
                        wakeUpWarningTimeout = undefined;
                    }, PING_WAKE_UP_WARNING_TIMEOUT);

                    await timeout(ping, PING_WAKE_UP_TIMEOUT);

                    if (wakeUpWarningTimeout) {
                        clearTimeout(wakeUpWarningTimeout);
                        wakeUpWarningTimeout = undefined;
                    }

                    this._handleUpdate(new UpdateConnectionState(UpdateConnectionState.connected));
                }

                lastPongAt = Date.now();
            } catch (err) {
                // eslint-disable-next-line no-console
                console.warn(err);

                lastPongAt = undefined;

                if (sender.isReconnecting || this._isSwitchingDc) {
                    continue;
                }
                if (this._destroyed) {
                    break;
                }
                sender.reconnect();
            }

            // We need to send some content-related request at least hourly
            // for Telegram to keep delivering updates, otherwise they will
            // just stop even if we're connected. Do so every 30 minutes.

            if (Date.now() - this._lastRequest > 30 * 60 * 1000) {
                try {
                    await this.pingCallback?.();
                } catch (e: unknown) {
                    // we don't care about errors here
                }

                lastPongAt = undefined;
            }
        }
        await this.disconnect();
    }

    /**
     * Disconnects from the Telegram server
     * @returns {Promise<void>}
     */
    async disconnect() {
        await this._sender?.disconnect();

        await Promise.all(
            Object.values(this._exportedSenderPromises)
                .map((promises) => {
                    return Object.values(promises).map((promise) => {
                        return promise?.then((sender) => {
                            return sender?.disconnect();
                        });
                    });
                }).flat(),
        );

        Object.values(this._exportedSenderReleaseTimeouts).forEach((timeouts) => {
            Object.values(timeouts).forEach((releaseTimeout) => {
                clearTimeout(releaseTimeout);
            });
        });

        this._exportedSenderRefCounter = {};
        this._exportedSenderPromises = {};
        this._waitingForAuthKey = {};
    }

    /**
     * Disconnects all senders and removes all handlers
     * @returns {Promise<void>}
     */
    async destroy() {
        this._destroyed = true;

        try {
            await this.disconnect();
            this._sender?.destroy();
        } catch (err) {
            // Do nothing
        }

        this.session.delete();
        this._eventBuilders = [];
    }

    async _switchDC(newDc: number) {
        if (!this._sender) {
            throw new Error('Sender is not initialized');
        }

        this._log.info(`Reconnecting to new data center ${newDc}`);
        const DC = getDC(newDc);
        const isTestServer = this.session.isTestServer || this._args.isTestServerRequested;
        this.session.setDC(newDc, DC.ipAddress, DC.port, isTestServer);
        // authKey's are associated with a server, which has now changed
        // so it's not valid anymore. Set to None to force recreating it.
        await this._sender.authKey.setKey(undefined);
        this.session.setAuthKey(undefined);
        this._isSwitchingDc = true;
        await this.disconnect();
        this._sender = undefined;
        return this.connect();
    }

    _authKeyCallback(authKey: AuthKey, dcId: number) {
        this.session.setAuthKey(authKey, dcId);
    }

    // endregion
    // export region

    async _cleanupExportedSender(dcId: number, index: number) {
        if (this.session.dcId !== dcId) {
            this.session.setAuthKey(undefined, dcId);
        }
        // eslint-disable-next-line no-console
        if (this._shouldDebugExportedSenders) console.log(`🧹 Cleanup idx=${index} dcId=${dcId}`);
        const sender = await this._exportedSenderPromises[dcId][index];
        delete this._exportedSenderPromises[dcId][index];
        delete this._exportedSenderRefCounter[dcId][index];
        await sender?.disconnect();
    }

    async _cleanupExportedSenders(dcId: number) {
        const promises = Object.values(this._exportedSenderPromises[dcId]);
        if (!promises.length) {
            return;
        }

        if (this.session.dcId !== dcId) {
            this.session.setAuthKey(undefined, dcId);
        }

        this._exportedSenderPromises[dcId] = {};
        this._exportedSenderRefCounter[dcId] = {};

        await Promise.all(promises.map(async (promise) => {
            const sender = await promise;
            await sender?.disconnect();
        }));
    }

    async _connectSender(sender: MTProtoSender, dcId: number, index?: number, isPremium = false) {
        // if we don't already have an auth key we want to use normal DCs not -1
        let hasAuthKey = Boolean(sender.authKey.getKey());
        let firstConnectResolver: (() => void) | undefined;

        if (!hasAuthKey) {
            if (this._waitingForAuthKey[dcId]) {
                await this._waitingForAuthKey[dcId];

                const authKey = this.session.getAuthKey(dcId);

                hasAuthKey = Boolean(sender.authKey?.getKey());
                if (hasAuthKey) {
                    await sender.authKey.setKey(authKey.getKey());
                }
            } else {
                this._waitingForAuthKey[dcId] = new Promise((resolve) => {
                    firstConnectResolver = resolve;
                });
            }
        }

        const dc = getDC(dcId, hasAuthKey);

        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                await sender.connect(new this._connection({
                    ip: dc.ipAddress,
                    port: dc.port,
                    dcId,
                    loggers: this._log,
                    isTestServer: this.session.isTestServer,
                    // Premium DCs are not stable for obtaining auth keys, so need to we first connect to regular ones
                    isPremium: hasAuthKey ? isPremium : false,
                }), false, new this._fallbackConnection({
                    ip: dc.ipAddress,
                    port: dc.port,
                    dcId,
                    loggers: this._log,
                    isTestServer: this.session.isTestServer,
                    isPremium: hasAuthKey ? isPremium : false,
                }));

                if (this.session.dcId !== dcId && !sender._authenticated) {
                    // Prevent another connection from trying to export the auth key while we're doing it
                    await navigator.locks.request('GRAMJS_AUTH_EXPORT', async () => {
                        this._log.info(`Exporting authorization for data center ${dc.ipAddress}`);
                        const auth = await this.invoke(new Api.auth.ExportAuthorization({ dcId }));

                        const req = this._initWith(new Api.auth.ImportAuthorization({
                            id: auth.id,
                            bytes: auth.bytes,
                        }));
                        await sender.send(req);
                        sender._authenticated = true;
                    });
                }

                sender._dcId = dcId;
                sender.userDisconnected = false;

                if (firstConnectResolver) {
                    firstConnectResolver();
                    delete this._waitingForAuthKey[dcId];
                }

                if (this._shouldDebugExportedSenders) {
                    // eslint-disable-next-line no-console
                    console.warn(`✅ Connected to exported sender idx=${index} dc=${dcId}`);
                }

                return sender;
            } catch (err: any) {
                if (this._shouldDebugExportedSenders) {
                    // eslint-disable-next-line no-console
                    console.error(`☠️ ERROR! idx=${index} dcId=${dcId} ${err.message}`);
                }
                // eslint-disable-next-line no-console
                console.error(err);

                await sleep(1000);
                await sender.disconnect();
            }
        }
    }

    releaseExportedSender(sender: MTProtoSender) {
        const dcId = sender._dcId;
        const index = sender._senderIndex;

        if (!this._exportedSenderRefCounter[dcId]) return;
        if (!this._exportedSenderRefCounter[dcId][index]) return;

        this._exportedSenderRefCounter[dcId][index] -= 1;

        if (this._exportedSenderRefCounter[dcId][index] <= 0) {
            if (!this._exportedSenderReleaseTimeouts[dcId]) this._exportedSenderReleaseTimeouts[dcId] = {};

            this._exportedSenderReleaseTimeouts[dcId][index] = setTimeout(() => {
                // eslint-disable-next-line no-console
                if (this._shouldDebugExportedSenders) console.log(`[CC] [idx=${index} dcId=${dcId}] 🚪 Release`);
                sender.disconnect();
                this._exportedSenderReleaseTimeouts[dcId][index] = undefined;
                this._exportedSenderPromises[dcId][index] = undefined;
            }, EXPORTED_SENDER_RELEASE_TIMEOUT);
        }
    }

    async _borrowExportedSender(
        dcId: number, shouldReconnect?: boolean, existingSender?: MTProtoSender, index?: number, isPremium?: boolean,
    ): Promise<MTProtoSender> {
        const i = index || 0;

        if (!this._exportedSenderPromises[dcId]) this._exportedSenderPromises[dcId] = {};
        if (!this._exportedSenderRefCounter[dcId]) this._exportedSenderRefCounter[dcId] = {};

        if (!this._exportedSenderPromises[dcId][i] || shouldReconnect) {
            if (this._shouldDebugExportedSenders) {
                // eslint-disable-next-line no-console
                console.warn(`🕒 Connecting to exported sender idx=${i} dc=${dcId}`
                    + ` ${shouldReconnect ? '(reconnect)' : ''}`);
            }
            this._exportedSenderRefCounter[dcId][i] = 0;
            this._exportedSenderPromises[dcId][i] = this._connectSender(
                existingSender || this._createExportedSender(dcId, i),
                dcId,
                index,
                isPremium,
            );
        }

        let sender;
        try {
            sender = await this._exportedSenderPromises[dcId][i];

            if (!sender?.isConnected()) {
                if (sender?.isConnecting) {
                    await sleep(EXPORTED_SENDER_RECONNECT_TIMEOUT);
                    return this._borrowExportedSender(dcId, false, sender, i, isPremium);
                } else {
                    return this._borrowExportedSender(dcId, true, sender, i, isPremium);
                }
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err);

            return this._borrowExportedSender(dcId, true, undefined, i, isPremium);
        }

        this._exportedSenderRefCounter[dcId][i] += 1;
        if (!this._exportedSenderReleaseTimeouts[dcId]) this._exportedSenderReleaseTimeouts[dcId] = {};
        if (this._exportedSenderReleaseTimeouts[dcId][i]) {
            clearTimeout(this._exportedSenderReleaseTimeouts[dcId][i]);
            this._exportedSenderReleaseTimeouts[dcId][i] = undefined;
        }

        return sender;
    }

    _createExportedSender(dcId: number, index: number) {
        return new MTProtoSender(this.session.getAuthKey(dcId), {
            logger: this._log,
            dcId,
            senderIndex: index,
            retries: this._connectionRetries,
            retriesToFallback: this._connectionRetriesToFallback,
            delay: this._retryDelay,
            retryMainConnectionDelay: this._retryMainConnectionDelay,
            shouldForceHttpTransport: this._shouldForceHttpTransport,
            shouldAllowHttpTransport: this._shouldAllowHttpTransport,
            autoReconnect: this._autoReconnect,
            connectTimeout: this._timeout,
            authKeyCallback: this._authKeyCallback.bind(this),
            isMainSender: dcId === this.session.dcId,
            isExported: true,
            updateCallback: this._handleUpdate.bind(this),
            getShouldDebugExportedSenders: this.getShouldDebugExportedSenders.bind(this),
            onConnectionBreak: () => this._cleanupExportedSender(dcId, index),
        });
    }

    getSender(dcId: number, index?: number, isPremium?: boolean) {
        return dcId
            ? this._borrowExportedSender(dcId, undefined, undefined, index, isPremium)
            : Promise.resolve(this._sender!);
    }

    // end region

    // download region

    /**
     * Complete flow to download a file.
     * @param inputLocation {Api.InputFileLocation}
     * @param [args[partSizeKb] {number}]
     * @param [args[fileSize] {number}]
     * @param [args[progressCallback] {Function}]
     * @param [args[start] {number}]
     * @param [args[end] {number}]
     * @param [args[dcId] {number}]
     * @param [args[workers] {number}]
     * @param [args[isPriority] {boolean}]
     * @returns {Promise<Buffer>}
     */
    downloadFile(inputLocation: Api.TypeInputFileLocation, args: DownloadFileWithDcParams) {
        return downloadFile(this, inputLocation, args, this._shouldDebugExportedSenders);
    }

    downloadMedia(
        entityOrMedia: Api.Message | Api.TypeMessageMedia, args: DownloadMediaParams & Partial<DownloadFileParams>,
    ) {
        let media;
        if (entityOrMedia instanceof Api.Message || entityOrMedia instanceof Api.StoryItem) {
            media = entityOrMedia.media;
        } else if (entityOrMedia instanceof Api.MessageService) {
            const action = entityOrMedia.action;
            if ('photo' in action) {
                media = action.photo;
            }
        } else {
            media = entityOrMedia;
        }

        if (media instanceof Api.MessageMediaWebPage) {
            if (media.webpage instanceof Api.WebPage) {
                media = media.webpage.document || media.webpage.photo;
            }
        }
        if (media instanceof Api.MessageMediaPhoto || media instanceof Api.Photo) {
            return this._downloadPhoto(media, args);
        } else if (media instanceof Api.MessageMediaDocument || media instanceof Api.Document) {
            return this._downloadDocument(media, args);
        } else if (media instanceof Api.WebDocument || media instanceof Api.WebDocumentNoProxy) {
            return this._downloadWebDocument(media);
        }
        return undefined;
    }

    downloadProfilePhoto(entity: Api.User | Api.Chat, isBig = false) {
        const photo = entity.photo;

        if (!(photo instanceof Api.UserProfilePhoto
            || photo instanceof Api.ChatPhoto)) return undefined;

        const dcId = photo.dcId;
        const loc = new Api.InputPeerPhotoFileLocation({
            peer: getInputPeer(entity),
            photoId: photo.photoId,
            big: isBig || undefined,
        });

        return this.downloadFile(loc, {
            dcId,
            isPriority: true,
        }) as Promise<Buffer | undefined>; // Profile photo cannot be larger than 2GB, right?
    }

    downloadStickerSetThumb(stickerSet: Api.StickerSet) {
        if (!stickerSet.thumbs?.length && !stickerSet.thumbDocumentId) {
            return undefined;
        }

        const thumbVersion = stickerSet.thumbVersion!;

        if (!stickerSet.thumbDocumentId) {
            return this.downloadFile(
                new Api.InputStickerSetThumb({
                    stickerset: new Api.InputStickerSetID({
                        id: stickerSet.id,
                        accessHash: stickerSet.accessHash,
                    }),
                    thumbVersion,
                }),
                { dcId: stickerSet.thumbDcId! },
            ) as Promise<Buffer | undefined>; // Sticker thumb cannot be larger than 2GB, right?
        }

        return this.invoke(new Api.messages.GetCustomEmojiDocuments({
            documentId: [stickerSet.thumbDocumentId],
        })).then((docs) => {
            const doc = docs[0];
            if (!doc || doc instanceof Api.DocumentEmpty) {
                return undefined;
            }

            return this.downloadFile(new Api.InputDocumentFileLocation({
                id: doc.id,
                accessHash: doc.accessHash,
                fileReference: doc.fileReference,
                thumbSize: '',
            }),
            {
                fileSize: doc.size.toJSNumber(),
                dcId: doc.dcId,
            }) as Promise<Buffer | undefined>; // Sticker thumb cannot be larger than 2GB, right?
        });
    }

    pickFileSize(sizes: (Api.TypePhotoSize | Api.TypeVideoSize)[], sizeType?: SizeType) {
        if (!sizes?.length) return undefined;
        if (!sizeType) {
            const maxSize = sizes.reduce((max, current) => {
                if (!('w' in current)) return max;
                if (!max || !('w' in max)) return current;
                return max.w > current.w ? max : current;
            }, undefined as Api.TypePhotoSize | Api.TypeVideoSize | undefined);
            return maxSize;
        }

        const indexOfSize = sizeTypes.indexOf(sizeType);
        let size;
        for (let i = indexOfSize; i < sizeTypes.length; i++) {
            size = sizes.find((s) => 'type' in s && s.type === sizeTypes[i]);
            if (size) {
                return size;
            }
        }
        return undefined;
    }

    _downloadCachedPhotoSize(size: Api.PhotoCachedSize | Api.PhotoStrippedSize) {
        // No need to download anything, simply write the bytes
        let data;
        if (size instanceof Api.PhotoStrippedSize) {
            data = strippedPhotoToJpg(size.bytes);
        } else {
            data = size.bytes;
        }
        return data;
    }

    _downloadPhoto(media: Api.MessageMediaPhoto | Api.TypePhoto, args: DownloadMediaParams) {
        let photo = media;
        if (media instanceof Api.MessageMediaPhoto && media.photo instanceof Api.Photo) {
            photo = media.photo;
        }

        if (!(photo instanceof Api.Photo)) {
            return undefined;
        }

        const isVideoSize = args.sizeType === 'u' || args.sizeType === 'v';
        const videoSizes = isVideoSize ? photo.videoSizes! : [];
        const size = this.pickFileSize([...videoSizes, ...photo.sizes], args.sizeType);

        if (!size
            || size instanceof Api.PhotoSizeEmpty
            || size instanceof Api.VideoSizeEmojiMarkup
            || size instanceof Api.VideoSizeStickerMarkup) {
            return undefined;
        }

        if (size instanceof Api.PhotoCachedSize || size instanceof Api.PhotoStrippedSize) {
            return this._downloadCachedPhotoSize(size);
        }

        let fileSize: number;
        if (size instanceof Api.PhotoSizeProgressive) {
            fileSize = Math.max(...size.sizes);
        } else {
            fileSize = "size" in size ? size.size : 512;
        }

        return this.downloadFile(
            new Api.InputPhotoFileLocation({
                id: photo.id,
                accessHash: photo.accessHash,
                fileReference: photo.fileReference,
                thumbSize: size.type,
            }),
            {
                dcId: photo.dcId,
                fileSize,
                progressCallback: args.progressCallback,
            },
        );
    }

    _downloadDocument(
        media: Api.MessageMediaDocument | Api.TypeDocument, args: DownloadMediaParams & DownloadFileParams,
    ) {
        let doc = media;
        if (doc instanceof Api.MessageMediaDocument && doc.document instanceof Api.Document) {
            doc = doc.document;
        }
        if (!(doc instanceof Api.Document)) {
            return undefined;
        }

        let size;
        if (args.sizeType) {
            size = this.pickFileSize([...(doc.thumbs || []), ...(doc.videoThumbs || [])], args.sizeType);
            if (!size && doc.mimeType.startsWith('video/')) {
                return undefined;
            }

            if (size && (size instanceof Api.PhotoCachedSize
                || size instanceof Api.PhotoStrippedSize)) {
                return this._downloadCachedPhotoSize(size);
            }
        }

        return this.downloadFile(
            new Api.InputDocumentFileLocation({
                id: doc.id,
                accessHash: doc.accessHash,
                fileReference: doc.fileReference,
                thumbSize: size && "type" in size ? size.type : "",
            }),
            {
                fileSize: size && "size" in size ? size.size : doc.size.toJSNumber(),
                progressCallback: args.progressCallback,
                start: args.start,
                end: args.end,
                dcId: doc.dcId,
                workers: args.workers,
            },
        );
    }

    async _downloadWebDocument(media: Api.TypeWebDocument) {
        if (media instanceof Api.WebDocumentNoProxy) {
            const arrayBuff = await fetch(media.url).then((res) => res.arrayBuffer());
            return Buffer.from(arrayBuff);
        }

        try {
            const buff = [];
            let offset = 0;
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const downloaded = new Api.upload.GetWebFile({
                    location: new Api.InputWebFileLocation({
                        url: media.url,
                        accessHash: media.accessHash,
                    }),
                    offset,
                    limit: WEBDOCUMENT_REQUEST_PART_SIZE,
                });

                const sender = await this._borrowExportedSender(
                    this._config?.webfileDcId || DEFAULT_WEBDOCUMENT_DC_ID,
                );
                if (!sender) {
                    throw new Error('Failed to obtain sender');
                }
                const res = (await sender.send(downloaded))!;
                this.releaseExportedSender(sender);
                offset += WEBDOCUMENT_REQUEST_PART_SIZE;
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
        } catch (err: unknown) {
            // the file is no longer saved in telegram's cache.
            if (err instanceof RPCError && err.errorMessage === 'WEBFILE_NOT_AVAILABLE') {
                return Buffer.alloc(0);
            } else {
                throw err;
            }
        }
    }

    async downloadStaticMap(
        accessHash: bigInt.BigInteger,
        long: number,
        lat: number,
        w: number,
        h: number,
        zoom: number,
        scale: number,
        accuracyRadius?: number,
    ) {
        try {
            const buff = [];
            let offset = 0;
            // eslint-disable-next-line no-constant-condition
            while (true) {
                try {
                    const downloaded = new Api.upload.GetWebFile({
                        location: new Api.InputWebFileGeoPointLocation({
                            geoPoint: new Api.InputGeoPoint({
                                lat,
                                long,
                                accuracyRadius,
                            }),
                            accessHash,
                            w,
                            h,
                            zoom,
                            scale,
                        }),
                        offset,
                        limit: WEBDOCUMENT_REQUEST_PART_SIZE,
                    });
                    const sender = await this._borrowExportedSender(DEFAULT_WEBDOCUMENT_DC_ID);
                    if (!sender) {
                        throw new Error('Failed to obtain sender');
                    }
                    const res = (await sender.send(downloaded))!;
                    this.releaseExportedSender(sender);
                    offset += WEBDOCUMENT_REQUEST_PART_SIZE;
                    if (res.bytes.length) {
                        buff.push(res.bytes);
                        if (res.bytes.length < WEBDOCUMENT_REQUEST_PART_SIZE) {
                            break;
                        }
                    } else {
                        break;
                    }
                } catch (err) {
                    if (err instanceof FloodWaitError) {
                        // eslint-disable-next-line no-console
                        console.warn(`getWebFile: sleeping for ${err.seconds}s on flood wait`);
                        await sleep(err.seconds * 1000);
                        continue;
                    }
                }
            }
            return Buffer.concat(buff);
        } catch (err: unknown) {
            if (err instanceof RPCError && err.errorMessage === 'WEBFILE_NOT_AVAILABLE') {
                return Buffer.alloc(0);
            } else {
                throw err;
            }
        }
    }

    // region Invoking Telegram request
    /**
     * Invokes a MTProtoRequest (sends and receives it) and returns its result
     * @param request
     * @param dcId Optional dcId to use when sending the request
     * @param abortSignal Optional AbortSignal to cancel the request
     * @param shouldRetryOnTimeout Whether to retry the request if it times out
     * @returns {Promise}
     */

    async invoke<R extends Api.AnyRequest>(
        request: R, dcId?: number, abortSignal?: AbortSignal, shouldRetryOnTimeout?: boolean,
    ): Promise<R['__response']> {
        if (request.classType !== 'request') {
            throw new Error('You can only invoke MTProtoRequests');
        }

        const isExported = dcId !== undefined;
        let sender = (!isExported ? this._sender : await this.getSender(dcId))!;
        this._lastRequest = Date.now();

        await this._connectedDeferred.promise;

        const state = new RequestState(request, abortSignal);

        let attempt = 0;
        for (attempt = 0; attempt < this._requestRetries; attempt++) {
            sender.addStateToQueue(state);
            try {
                const result = await state.promise;
                state.finished.resolve();
                if (isExported) this.releaseExportedSender(sender);
                return result;
            } catch (e: unknown) {
                if (e instanceof ServerError
                    || (e instanceof RPCError && (
                        e.errorMessage === 'RPC_CALL_FAIL'
                        || e.errorMessage === 'RPC_MCGET_FAIL'
                        || e.errorMessage.match(/INTERDC_\d_CALL(_RICH)?_ERROR/)
                    ))
                ) {
                    this._log.warn(`Telegram is having internal issues ${e.constructor.name}`);
                    await sleep(2000);
                } else if (e instanceof FloodWaitError || e instanceof FloodTestPhoneWaitError) {
                    if (e.seconds <= this.floodSleepLimit) {
                        this._log.info(`Sleeping for ${e.seconds}s on flood wait`);
                        await sleep(e.seconds * 1000);
                    } else {
                        state.finished.resolve();
                        if (isExported) this.releaseExportedSender(sender);
                        throw e;
                    }
                } else if (e instanceof PhoneMigrateError || e instanceof NetworkMigrateError
                    || e instanceof UserMigrateError) {
                    this._log.info(`Phone migrated to ${e.newDc}`);
                    const shouldRaise = e instanceof PhoneMigrateError
                        || e instanceof NetworkMigrateError;
                    if (shouldRaise && await checkAuthorization(this)) {
                        state.finished.resolve();
                        if (isExported) this.releaseExportedSender(sender);
                        throw e;
                    }
                    await this._switchDC(e.newDc);
                    if (isExported) this.releaseExportedSender(sender);
                    sender = (dcId === undefined ? this._sender : await this.getSender(dcId))!;
                } else if (e instanceof MsgWaitError) {
                    // We need to resend this after the old one was confirmed.
                    await state.isReady();

                    state.after = undefined;
                } else if (e instanceof RPCError && e.errorMessage === 'CONNECTION_NOT_INITED') {
                    await this.disconnect();
                    await sleep(2000);
                    await this.connect();
                } else if (e instanceof TimedOutError) {
                    if (!shouldRetryOnTimeout) {
                        state.finished.resolve();
                        if (isExported) this.releaseExportedSender(sender);
                        throw e;
                    }
                } else {
                    state.finished.resolve();
                    if (isExported) this.releaseExportedSender(sender);
                    throw e;
                }
            }

            state.resetPromise();
        }
        if (isExported) this.releaseExportedSender(sender);
        throw new Error(`Request was unsuccessful ${attempt} time(s)`);
    }

    async invokeBeacon(request: Api.AnyRequest, dcId?: number) {
        if (request.classType !== 'request') {
            throw new Error('You can only invoke MTProtoRequests');
        }

        const isExported = dcId !== undefined;
        const sender = (!isExported ? this._sender : await this.getSender(dcId))!;

        sender.sendBeacon(request);

        if (isExported) this.releaseExportedSender(sender);
    }

    setIsPremium(isPremium: boolean) {
        this.isPremium = isPremium;
    }

    async getMe() {
        try {
            return (await this.invoke(
                new Api.users.GetUsers({
                    id: [new Api.InputUserSelf()],
                })
            ))[0];
        } catch (e: any) {
            this._log.warn('error while getting me');
            this._log.warn(e);
        }
        return undefined;
    }

    async loadConfig() {
        if (!this._config) {
            this._config = await this.invoke(new Api.help.GetConfig());
        }
    }

    async start(authParams: UserAuthParams) {
        if (!this.isConnected()) {
            await this.connect();
        }

        this.loadConfig();

        if (await checkAuthorization(this, authParams.shouldThrowIfUnauthorized)) {
            return;
        }

        const apiCredentials = {
            apiId: this.apiId,
            apiHash: this.apiHash,
        };

        await authFlow(this, apiCredentials, authParams);
    }

    uploadFile(fileParams: UploadFileParams) {
        return uploadFile(this, fileParams, this._shouldDebugExportedSenders);
    }

    updateTwoFaSettings(params: TwoFaParams) {
        return updateTwoFaSettings(this, params);
    }

    getTmpPassword(currentPassword: string, ttl?: number): Promise<TmpPasswordResult> {
        return getTmpPassword(this, currentPassword, ttl);
    }

    getCurrentPassword(currentPassword?: string): Promise<PasswordResult | undefined> {
        return getCurrentPassword(this, currentPassword);
    }

    // event region
    addEventHandler(callback: CallableFunction, event: EventBuilder) {
        this._eventBuilders.push([event, callback]);
    }

    _handleUpdate(update: Update) {
        // this.session.processEntities(update)
        // this._entityCache.add(update)

        if (update instanceof Api.Updates || update instanceof Api.UpdatesCombined) {
            // TODO deal with entities
            const entities = [];
            for (const x of [...update.users, ...update.chats]) {
                entities.push(x);
            }
            this._processUpdate(update, entities);
        } else if (update instanceof Api.UpdateShort) {
            this._processUpdate(update.update, undefined);
        } else {
            this._processUpdate(update, undefined);
        }
    }

    _processUpdate(update: Update, entities: (Api.TypeUser | Api.TypeChat)[] | undefined) {
        update._entities = entities || [];
        const args = {
            update,
        };
        this._dispatchUpdate(args);
    }

    // endregion

    async _dispatchUpdate(args: {
        update: Update,
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

function timeout(cb: () => void, ms: number) {
    let isResolved = false;

    return Promise.race([
        cb(),
        sleep(ms).then(() => (isResolved ? undefined : Promise.reject(new Error('TIMEOUT')))),
    ]).finally(() => {
        isResolved = true;
    });
}

async function attempts(cb: () => void, times: number, pause: number) {
    for (let i = 0; i < times; i++) {
        try {
            // We need to `return await` here so it can be caught locally
            // eslint-disable-next-line @typescript-eslint/return-await
            return await cb();
        } catch (err) {
            if (i === times - 1) {
                throw err;
            }

            await sleep(pause);
        }
    }
    return undefined;
}

export default TelegramClient;
