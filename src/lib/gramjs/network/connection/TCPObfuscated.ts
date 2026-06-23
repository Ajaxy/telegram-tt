import type { HttpStream, PromisedWebSockets } from '../../extensions';

import { bufferFromHex, buffersEqual, concat } from '../../../../util/encoding/buffer';
import { CTR } from '../../crypto/CTR';

import { generateRandomBytes } from '../../Helpers';
import { ObfuscatedConnection } from './Connection';
import { AbridgedPacketCodec } from './TCPAbridged';

class ObfuscatedIO {
  header?: Uint8Array = undefined;

  private connection: PromisedWebSockets | HttpStream;

  private _encrypt: CTR;

  private _decrypt: CTR;

  constructor(connection: ConnectionTCPObfuscated) {
    this.connection = connection.socket;
    const res = this.initHeader(connection.PacketCodecClass);
    this.header = res.random;

    this._encrypt = res.encryptor;
    this._decrypt = res.decryptor;
  }

  initHeader(packetCodec: typeof AbridgedPacketCodec) {
    // Obfuscated messages secrets cannot start with any of these
    const keywords = [
      bufferFromHex('50567247'),
      bufferFromHex('474554'),
      bufferFromHex('504f5354'),
      bufferFromHex('eeeeeeee'),
    ];
    let random;

    while (true) {
      random = generateRandomBytes(64);
      if (random[0] !== 0xef && !(buffersEqual(random.slice(4, 8), new Uint8Array(4)))) {
        let ok = true;
        for (const key of keywords) {
          if (buffersEqual(key, random.slice(0, 4))) {
            ok = false;
            break;
          }
        }
        if (ok) {
          break;
        }
      }
    }

    const randomReversed = random.slice(8, 56).reverse();
    // Encryption has "continuous buffer" enabled
    const encryptKey = random.slice(8, 40);
    const encryptIv = random.slice(40, 56);
    const decryptKey = randomReversed.slice(0, 32);
    const decryptIv = randomReversed.slice(32, 48);
    const encryptor = new CTR(encryptKey, encryptIv);
    const decryptor = new CTR(decryptKey, decryptIv);

    random = concat(
      random.slice(0, 56), packetCodec.obfuscateTag, random.slice(60),
    );
    random = concat(
      random.slice(0, 56), encryptor.encrypt(random).slice(56, 64), random.slice(64),
    );
    return {
      random,
      encryptor,
      decryptor,
    };
  }

  async read(n: number) {
    const data = await this.connection.readExactly(n);
    return this._decrypt.encrypt(data);
  }

  write(data: Uint8Array) {
    this.connection.write(this._encrypt.encrypt(data));
  }
}

export class ConnectionTCPObfuscated extends ObfuscatedConnection {
  ObfuscatedIO = ObfuscatedIO;

  PacketCodecClass = AbridgedPacketCodec;
}
