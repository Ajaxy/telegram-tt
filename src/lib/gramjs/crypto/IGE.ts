import { IGE as AesIge } from '@cryptography/aes';

import { concat } from '../../../util/encoding/buffer';

import { convertToLittle, generateRandomBytes } from '../Helpers';

class IGENEW {
  private ige: AesIge;

  constructor(key: Uint8Array, iv: Uint8Array) {
    this.ige = new AesIge(key, iv);
  }

  /**
     * Decrypts the given text in 16-bytes blocks by using the given key and 32-bytes initialization vector
  */
  decryptIge(cipherText: Uint8Array): Uint8Array {
    return convertToLittle(this.ige.decrypt(cipherText));
  }

  /**
     * Encrypts the given text in 16-bytes blocks by using the given key and 32-bytes initialization vector
     */
  encryptIge(plainText: Uint8Array) {
    const padding = plainText.length % 16;
    if (padding) {
      plainText = concat(
        plainText,
        generateRandomBytes(16 - padding),
      );
    }

    return convertToLittle(this.ige.encrypt(plainText));
  }
}

export { IGENEW as IGE };
