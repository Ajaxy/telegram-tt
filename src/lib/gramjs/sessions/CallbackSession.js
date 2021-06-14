const MemorySession = require('./Memory');
const AuthKey = require('../crypto/AuthKey');
const utils = require('../Utils');

class CallbackSession extends MemorySession {
    constructor(sessionData, callback) {
        super();

        this._sessionData = sessionData;
        this._callback = callback;

        this._authKeys = {};
    }

    get authKey() {
        throw new Error('Not supported');
    }

    set authKey(value) {
        throw new Error('Not supported');
    }

    async load() {
        if (!this._sessionData) {
            return;
        }

        const {
            mainDcId,
            keys,
            hashes,
        } = this._sessionData;
        const {
            ipAddress,
            port,
        } = utils.getDC(mainDcId);

        this.setDC(mainDcId, ipAddress, port, true);

        await Promise.all(Object.keys(keys)
            .map(async (dcId) => {
                const key = typeof keys[dcId] === 'string'
                    ? Buffer.from(keys[dcId], 'hex')
                    : Buffer.from(keys[dcId]);

                if (hashes[dcId]) {
                    const hash = typeof hashes[dcId] === 'string'
                        ? Buffer.from(hashes[dcId], 'hex')
                        : Buffer.from(hashes[dcId]);

                    this._authKeys[dcId] = new AuthKey(key, hash);
                } else {
                    this._authKeys[dcId] = new AuthKey();
                    await this._authKeys[dcId].setKey(key, true);
                }
            }));
    }

    setDC(dcId, serverAddress, port, skipOnUpdate = false) {
        this._dcId = dcId;
        this._serverAddress = serverAddress;
        this._port = port;

        delete this._authKeys[dcId];

        if (!skipOnUpdate) {
            void this._onUpdate();
        }
    }

    getAuthKey(dcId = this._dcId) {
        return this._authKeys[dcId];
    }

    setAuthKey(authKey, dcId = this._dcId) {
        this._authKeys[dcId] = authKey;

        void this._onUpdate();
    }

    getSessionData() {
        const sessionData = {
            mainDcId: this._dcId,
            keys: {},
            hashes: {},
        };

        Object
            .keys(this._authKeys)
            .forEach((dcId) => {
                const authKey = this._authKeys[dcId];
                if (!authKey || !authKey._key) return;

                sessionData.keys[dcId] = authKey._key.toString('hex');
                sessionData.hashes[dcId] = authKey._hash.toString('hex');
            });

        return sessionData;
    }

    _onUpdate() {
        this._callback(this.getSessionData());
    }

    delete() {
        this._callback(undefined);
    }
}

module.exports = CallbackSession;
