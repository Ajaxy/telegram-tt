const MemorySession = require('./Memory');
const AuthKey = require('../crypto/AuthKey');
const utils = require('../Utils');

const STORAGE_KEY_BASE = 'GramJs-session-';
const SESSION_DATA_PREFIX = 'session:';

class StorageSession extends MemorySession {
    constructor(sessionInfo) {
        super();

        this._authKeys = {};

        if (sessionInfo && sessionInfo.startsWith(SESSION_DATA_PREFIX)) {
            this._sessionString = sessionInfo;
        } else if (sessionInfo) {
            this._storageKey = sessionInfo;
        }
    }

    get authKey() {
        throw new Error('Not supported');
    }

    set authKey(value) {
        throw new Error('Not supported');
    }

    async load() {
        if (this._sessionString) {
            await this._loadFromSessionString();
            return;
        }

        if (!this._storageKey) {
            return;
        }

        try {
            const json = await this._fetchFromCache();
            const {
                mainDcId,
                keys,
                hashes,
            } = JSON.parse(json);
            const {
                ipAddress,
                port,
            } = utils.getDC(mainDcId);

            this.setDC(mainDcId, ipAddress, port, true);

            Object.keys(keys)
                .forEach((dcId) => {
                    if (keys[dcId] && hashes[dcId]) {
                        this._authKeys[dcId] = new AuthKey(
                            Buffer.from(keys[dcId].data),
                            Buffer.from(hashes[dcId].data),
                        );
                    }
                });
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('Failed to retrieve or parse session from storage');
            // eslint-disable-next-line no-console
            console.warn(err);
        }
    }

    setDC(dcId, serverAddress, port, skipUpdateStorage = false) {
        this._dcId = dcId;
        this._serverAddress = serverAddress;
        this._port = port;

        delete this._authKeys[dcId];

        if (!skipUpdateStorage) {
            void this._updateStorage();
        }
    }

    async save() {
        if (!this._storageKey) {
            this._storageKey = generateStorageKey();
        }

        await this._updateStorage();

        return this._storageKey;
    }

    getAuthKey(dcId = this._dcId) {
        return this._authKeys[dcId];
    }

    setAuthKey(authKey, dcId = this._dcId) {
        this._authKeys[dcId] = authKey;

        void this._updateStorage();
    }

    getSessionData(asHex) {
        const sessionData = {
            mainDcId: this._dcId,
            keys: {},
            hashes: {},
        };

        Object
            .keys(this._authKeys)
            .forEach((dcId) => {
                const authKey = this._authKeys[dcId];
                if (!authKey._key) return;

                sessionData.keys[dcId] = asHex ? authKey._key.toString('hex') : authKey._key;
                sessionData.hashes[dcId] = asHex ? authKey._hash.toString('hex') : authKey._hash;
            });

        return sessionData;
    }

    async _loadFromSessionString() {
        const [, mainDcIdStr, mainDcKey] = this._sessionString.split(':');
        const mainDcId = Number(mainDcIdStr);
        const {
            ipAddress,
            port,
        } = utils.getDC(mainDcId);
        this.setDC(mainDcId, ipAddress, port);
        const authKey = new AuthKey();
        await authKey.setKey(Buffer.from(mainDcKey, 'hex'), true);
        this.setAuthKey(authKey, mainDcId);
    }

    async _updateStorage() {
        if (!this._storageKey) {
            return;
        }

        try {
            await this._saveToCache(JSON.stringify(this.getSessionData()));
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('Failed to update session in storage');
            // eslint-disable-next-line no-console
            console.warn(err);
        }
    }

    async delete() {
        try {
            const deleted = await this._delete();
            return deleted;
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('Failed to delete session from storage');
            // eslint-disable-next-line no-console
            console.warn(err);
        }
        return undefined;
    }

    // @abstract
    _delete() {
        throw new Error('Not Implemented');
    }

    // @abstract
    _fetchFromCache() {
        throw new Error('Not Implemented');
    }

    // @abstract
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _saveToCache(data) {
        throw new Error('Not Implemented');
    }
}

function generateStorageKey() {
    // Creating two sessions at the same moment is not expected nor supported.
    return `${STORAGE_KEY_BASE}${Date.now()}`;
}

module.exports = StorageSession;
