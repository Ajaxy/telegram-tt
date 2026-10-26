import type { SessionData } from '../types';

import { bufferFromHex, bufferToHex } from '../../../util/encoding/buffer';

import { AuthKey } from '../crypto/AuthKey';
import { getDC } from '../Utils';
import MemorySession from './Memory';

export default class CallbackSession extends MemorySession {
  private _sessionData?: SessionData;

  private _callback: (session?: SessionData) => void;

  private _authKeys: Record<number, AuthKey>;

  private _tempAuthKey?: AuthKey;

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
      authKeyCreatedAt,
      tempAuthKey,
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
        const key = bufferFromHex(keys[dcId]);

        this._authKeys[dcId] = new AuthKey();
        await this._authKeys[dcId].setKey(key);
        this._authKeys[dcId].createdAt = authKeyCreatedAt?.[dcId];
      }));

    if (tempAuthKey) {
      this._tempAuthKey = new AuthKey();
      await this._tempAuthKey.setKey(bufferFromHex(tempAuthKey.key));
      this._tempAuthKey.expiresAt = tempAuthKey.expiresAt;
    }
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

  getTempAuthKey() {
    return this._tempAuthKey;
  }

  setTempAuthKey(authKey?: AuthKey) {
    this._tempAuthKey = authKey;

    void this._onUpdate();
  }

  getSessionData() {
    const tempAuthKey = this._tempAuthKey?._key;
    const sessionData: SessionData = {
      mainDcId: this._dcId,
      keys: {},
      authKeyCreatedAt: {},
      tempAuthKey: tempAuthKey
        ? { key: bufferToHex(tempAuthKey), expiresAt: this._tempAuthKey!.expiresAt! }
        : undefined,
      isTest: this._isTestServer || undefined,
    };

    Object
      .keys(this._authKeys)
      .forEach((dcIdStr) => {
        const dcId = Number(dcIdStr);
        const authKey = this._authKeys[dcId];
        if (!authKey?._key) return;

        sessionData.keys[dcId] = bufferToHex(authKey._key);
        if (authKey.createdAt !== undefined) sessionData.authKeyCreatedAt![dcId] = authKey.createdAt;
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
