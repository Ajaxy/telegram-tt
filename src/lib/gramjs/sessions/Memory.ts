import { AuthKey } from '../crypto/AuthKey';
import Session from './Abstract';

// Dummy implementation
export default class MemorySession extends Session {
    protected _serverAddress?: string;

    protected _dcId: number;

    protected _port?: number;

    protected _takeoutId: undefined;

    protected _entities: Set<any>;

    protected _updateStates: {};

    protected _isTestServer?: boolean;

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
        return this._serverAddress!;
    }

    get port() {
        return this._port!;
    }

    get isTestServer() {
        return this._isTestServer;
    }

    setDC(dcId: number, serverAddress: string, port: number, isTestServer?: boolean) {
        this._dcId = dcId | 0;
        this._serverAddress = serverAddress;
        this._port = port;
        this._isTestServer = isTestServer;
    }

    getAuthKey(dcId?: number | undefined): AuthKey {
        return new AuthKey();
    }

    setAuthKey(authKey: AuthKey, dcId?: number) {}

    async load(): Promise<void> {  }

    save() {}

    delete() {}
}
