import type { HttpStream, PromisedWebSockets } from '../../extensions';

import { bufferFromHex, buffersEqual, concat } from '../../../../util/encoding/buffer';
import { CTR } from '../../crypto/CTR';

import { generateRandomBytes } from '../../Helpers';
import { ObfuscatedConnection } from './Connection';
import { AbridgedPacketCodec } from './TCPAbridged';

const FORBIDDEN_OBFUSCATED_PREFIXES = [
  bufferFromHex('48454144'),
  bufferFromHex('504f5354'),
  bufferFromHex('47455420'),
  bufferFromHex('4f505449'),
  bufferFromHex('16030102'),
  bufferFromHex('dddddddd'),
  bufferFromHex('eeeeeeee'),
];
const ZERO_INT = new Uint8Array(4);

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
    // Prevent the random prefix from being detected as another accepted transport
    // https://core.telegram.org/mtproto/mtproto-transports#transport-obfuscation
    let random;

    while (true) {
      random = generateRandomBytes(64);
      const firstInt = random.slice(0, 4);
      const hasForbiddenPrefix = FORBIDDEN_OBFUSCATED_PREFIXES.some(
        (prefix) => buffersEqual(prefix, firstInt),
      );
      if (
        random[0] !== 0xef
        && !hasForbiddenPrefix
        && !buffersEqual(random.slice(4, 8), ZERO_INT)
      ) {
        break;
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
