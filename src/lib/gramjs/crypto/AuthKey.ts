import { buffersEqual, concat } from '../../../util/encoding/buffer';
import { BinaryReader } from '../extensions';

import {
  readBigIntFromBuffer,
  readBufferFromBigInt,
  sha1,
  sleep,
  toSignedLittleBuffer,
} from '../Helpers';

export class AuthKey {
  _key?: Uint8Array<ArrayBuffer>;

  _hash?: Uint8Array<ArrayBuffer>;

  private auxHash?: bigint;

  keyId?: bigint;

  constructor(value?: Uint8Array<ArrayBuffer>, hash?: Uint8Array<ArrayBuffer>) {
    if (!hash || !value) {
      return;
    }
    this._key = value;
    this._hash = hash;
    const reader = new BinaryReader(hash);
    this.auxHash = reader.readLong(false);
    reader.read(4);
    this.keyId = reader.readLong(false);
  }

  async setKey(value?: Uint8Array<ArrayBuffer> | AuthKey) {
    if (!value) {
      this._key = undefined;
      this.auxHash = undefined;
      this.keyId = undefined;
      this._hash = undefined;
      return;
    }
    if (value instanceof AuthKey) {
      this._key = value._key;
      this.auxHash = value.auxHash;
      this.keyId = value.keyId;
      this._hash = value._hash;
      return;
    }
    this._key = value;
    this._hash = await sha1(this._key);
    const reader = new BinaryReader(this._hash);
    this.auxHash = reader.readLong(false);
    reader.read(4);
    this.keyId = reader.readLong(false);
  }

  async waitForKey() {
    while (this.keyId === undefined) {
      await sleep(20);
    }
  }

  getKey() {
    return this._key;
  }

  // TODO : This doesn't really fit here, it's only used in authentication

  /**
     * Calculates the new nonce hash based on the current class fields' values
     * @param newNonce
     * @param number
     * @returns {bigint}
     */
  async calcNewNonceHash(
    newNonce: bigint,
    number: number,
  ): Promise<bigint> {
    if (this.auxHash === undefined) {
      throw new Error('Auth key not set');
    }

    const nonce = toSignedLittleBuffer(newNonce, 32);
    const n = new Uint8Array([number]);
    const data = concat(nonce, n, readBufferFromBigInt(this.auxHash, 8, true));

    // Calculates the message key from the given data
    const shaData = (await sha1(data)).slice(4, 20);
    return readBigIntFromBuffer(shaData, true, true);
  }

  equals(other: AuthKey) {
    const otherKey = other.getKey();
    return (
      other instanceof this.constructor
      && this._key
      && otherKey instanceof Uint8Array
      && buffersEqual(otherKey, this._key)
    );
  }
}
