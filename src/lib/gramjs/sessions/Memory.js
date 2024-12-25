const Session = require('./Abstract');

class MemorySession extends Session {
    constructor() {
        super();

        this._serverAddress = undefined;
        this._dcId = 0;
        this._port = undefined;
        this._takeoutId = undefined;
        this._isTestServer = false;

        this._entities = new Set();
        this._updateStates = {};
    }

    get dcId() {
        return this._dcId;
    }

    get serverAddress() {
        return this._serverAddress;
    }

    get port() {
        return this._port;
    }

    get authKey() {
        return this._authKey;
    }

    set authKey(value) {
        this._authKey = value;
    }

    get isTestServer() {
        return this._isTestServer;
    }

    setDC(dcId, serverAddress, port, isTestServer) {
        this._dcId = dcId | 0;
        this._serverAddress = serverAddress;
        this._port = port;
        this._isTestServer = isTestServer;
    }
}

module.exports = MemorySession;
