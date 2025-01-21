import type { SessionData } from '../types';

import { AuthKey } from '../crypto/AuthKey';
import { getDC } from '../Utils';
import MemorySession from './Memory';

export default class CallbackSession extends MemorySession {
    private _sessionData?: SessionData;

    private _callback: (session?: SessionData) => void;

    private _authKeys: Record<number, AuthKey>;

    constructor(sessionData: SessionData | undefined, callback: (session?: SessionData) => void) {
        super();

        this._sessionData = sessionData;
        this._callback = callback;

        this._authKeys = {};
    }

    async load() {
        if (!this._sessionData) {
            return;
        }

        const {
            mainDcId,
            keys,
            hashes,
            isTest,
        } = this._sessionData;
        const {
            ipAddress,
            port,
        } = getDC(mainDcId);

        this.setDC(mainDcId, ipAddress, port, isTest, true);

        await Promise.all(Object.keys(keys)
            .map(async (dcIdStr) => {
                const dcId = Number(dcIdStr);
                const key = typeof keys[dcId] === 'string'
                    ? Buffer.from(keys[dcId] as string, 'hex')
                    : Buffer.from(keys[dcId]);

                if (hashes[dcId]) {
                    const hash = typeof hashes[dcId] === 'string'
                        ? Buffer.from(hashes[dcId] as string, 'hex')
                        : Buffer.from(hashes[dcId]);

                    this._authKeys[dcId] = new AuthKey(key, hash);
                } else {
                    this._authKeys[dcId] = new AuthKey();
                    await this._authKeys[dcId].setKey(key);
                }
            }));
    }

    setDC(dcId: number, serverAddress: string, port: number, isTestServer?: boolean, skipOnUpdate = false) {
        this._dcId = dcId;
        this._serverAddress = serverAddress;
        this._port = port;
        this._isTestServer = isTestServer;

        delete this._authKeys[dcId];

        if (!skipOnUpdate) {
            void this._onUpdate();
        }
    }

    getAuthKey(dcId = this._dcId) {
        return this._authKeys[dcId];
    }

    setAuthKey(authKey: AuthKey, dcId = this._dcId) {
        this._authKeys[dcId] = authKey;

        void this._onUpdate();
    }

    getSessionData() {
        const sessionData: SessionData = {
            mainDcId: this._dcId,
            keys: {},
            hashes: {},
            isTest: this._isTestServer || undefined,
        };

        Object
            .keys(this._authKeys)
            .forEach((dcIdStr) => {
                const dcId = Number(dcIdStr);
                const authKey = this._authKeys[dcId];
                if (!authKey?._key) return;

                sessionData.keys[dcId] = authKey._key.toString('hex');
                sessionData.hashes[dcId] = authKey._hash!.toString('hex');
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
