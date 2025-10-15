import { IGE as AesIge } from '@cryptography/aes';

import { convertToLittle, generateRandomBytes } from '../Helpers';

class IGENEW {
  private ige: AesIge;

  constructor(key: Buffer, iv: Buffer) {
    this.ige = new AesIge(key, iv);
  }

  /**
     * Decrypts the given text in 16-bytes blocks by using the given key and 32-bytes initialization vector
     * @param cipherText {Buffer}
     * @returns {Buffer}
     */
  decryptIge(cipherText: Buffer): Buffer<ArrayBuffer> {
    return convertToLittle(this.ige.decrypt(cipherText));
  }

  /**
     * Encrypts the given text in 16-bytes blocks by using the given key and 32-bytes initialization vector
     * @param plainText {Buffer}
     * @returns {Buffer}
     */
  encryptIge(plainText: Buffer): Buffer<ArrayBuffer> {
    const padding = plainText.length % 16;
    if (padding) {
      plainText = Buffer.concat([
        plainText,
        generateRandomBytes(16 - padding),
      ]);
    }

    return convertToLittle(this.ige.encrypt(plainText));
  }
}

export { IGENEW as IGE };
