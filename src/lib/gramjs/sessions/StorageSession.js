const MemorySession = require('./Memory');
const AuthKey = require('../crypto/AuthKey');
const utils = require('../Utils');

const STORAGE_KEY_BASE = 'GramJs-session-';

class StorageSession extends MemorySession {
    constructor(sessionId) {
        super();
        this._storageKey = sessionId;
        this._authKeys = {};
    }

    get authKey() {
        throw new Error('Not supported');
    }

    set authKey(value) {
        throw new Error('Not supported');
    }

    async load() {
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
            console.warn('Failed to retrieve or parse session from storage');
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

    async _updateStorage() {
        if (!this._storageKey) {
            return;
        }

        const sessionData = {
            mainDcId: this._dcId,
            keys: {},
            hashes: {},
        };

        Object.keys(this._authKeys)
            .map((dcId) => {
                const authKey = this._authKeys[dcId];
                sessionData.keys[dcId] = authKey._key;
                sessionData.hashes[dcId] = authKey._hash;
            });

        try {
            await this._saveToCache(JSON.stringify(sessionData));
        } catch (err) {
            console.warn('Failed to update session in storage');
            console.warn(err);
        }
    }

    async delete() {
        try {
            return await this._delete();
        } catch (err) {
            console.warn('Failed to delete session from storage');
            console.warn(err);
        }
    }

    // @abstract
    async _delete() {
        throw new Error('Not Implemented');
    }

    // @abstract
    async _fetchFromCache() {
        throw new Error('Not Implemented');
    }

    // @abstract
    async _saveToCache(data) {
        throw new Error('Not Implemented');
    }
}

function generateStorageKey() {
    // Creating two sessions at the same moment is not expected nor supported.
    return `${STORAGE_KEY_BASE}${Date.now()}`;
}

module.exports = StorageSession;
