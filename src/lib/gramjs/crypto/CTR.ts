import { createCipheriv, createDecipheriv, type CtrImpl } from './crypto';

export class CTR {
  private cipher: CtrImpl;
  private decipher: CtrImpl;

  constructor(key: Uint8Array, iv: Uint8Array) {
    if (!(key instanceof Uint8Array) || !(iv instanceof Uint8Array) || iv.length !== 16) {
      throw new Error('Key and iv need to be a buffer');
    }

    this.cipher = createCipheriv('AES-256-CTR', key, iv);
    this.decipher = createDecipheriv('AES-256-CTR', key, iv);
  }

  encrypt(data: Uint8Array) {
    return this.cipher.update(data);
  }

  decrypt(data: Uint8Array) {
    return this.decipher.update(data);
  }
}
