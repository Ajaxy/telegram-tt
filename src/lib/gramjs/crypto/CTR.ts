import { createCipheriv, createDecipheriv, type CtrImpl } from './crypto';

export class CTR {
  private cipher: CtrImpl;
  private decipher: CtrImpl;

  constructor(key: Buffer, iv: Buffer) {
    if (!Buffer.isBuffer(key) || !Buffer.isBuffer(iv) || iv.length !== 16) {
      throw new Error('Key and iv need to be a buffer');
    }

    this.cipher = createCipheriv('AES-256-CTR', key, iv);
    this.decipher = createDecipheriv('AES-256-CTR', key, iv);
  }

  encrypt(data: Buffer<ArrayBuffer>) {
    return Buffer.from(this.cipher.update(data));
  }

  decrypt(data: Buffer<ArrayBuffer>) {
    return Buffer.from(this.decipher.update(data));
  }
}
