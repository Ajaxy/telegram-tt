import type { HttpStream, PromisedWebSockets } from '../../extensions';

import { CTR } from '../../crypto/CTR';

import { generateRandomBytes } from '../../Helpers';
import { ObfuscatedConnection } from './Connection';
import { AbridgedPacketCodec } from './TCPAbridged';

class ObfuscatedIO {
  header?: Buffer = undefined;

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
      Buffer.from('50567247', 'hex'),
      Buffer.from('474554', 'hex'),
      Buffer.from('504f5354', 'hex'),
      Buffer.from('eeeeeeee', 'hex'),
    ];
    let random;

    while (true) {
      random = generateRandomBytes(64);
      if (random[0] !== 0xef && !(random.slice(4, 8)
        .equals(Buffer.alloc(4)))) {
        let ok = true;
        for (const key of keywords) {
          if (key.equals(random.slice(0, 4))) {
            ok = false;
            break;
          }
        }
        if (ok) {
          break;
        }
      }
    }
    random = random.toJSON().data;

    const randomReversed = Buffer.from(random.slice(8, 56))
      .reverse();
    // Encryption has "continuous buffer" enabled
    const encryptKey = Buffer.from(random.slice(8, 40));
    const encryptIv = Buffer.from(random.slice(40, 56));
    const decryptKey = Buffer.from(randomReversed.slice(0, 32));
    const decryptIv = Buffer.from(randomReversed.slice(32, 48));
    const encryptor = new CTR(encryptKey, encryptIv);
    const decryptor = new CTR(decryptKey, decryptIv);

    random = Buffer.concat([
      Buffer.from(random.slice(0, 56)), packetCodec.obfuscateTag, Buffer.from(random.slice(60)),
    ]);
    random = Buffer.concat([
      Buffer.from(random.slice(0, 56)), Buffer.from(encryptor.encrypt(random)
        .slice(56, 64)), Buffer.from(random.slice(64)),
    ]);
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

  write(data: Buffer<ArrayBuffer>) {
    this.connection.write(this._encrypt.encrypt(data));
  }
}

export class ConnectionTCPObfuscated extends ObfuscatedConnection {
  ObfuscatedIO = ObfuscatedIO;

  PacketCodecClass = AbridgedPacketCodec;
}
