import type { PromisedWebSockets } from '../../extensions';

import { readBufferFromBigInt } from '../../Helpers';
import { Connection, PacketCodec } from './Connection';

export class AbridgedPacketCodec extends PacketCodec {
  static tag = Buffer.from('ef', 'hex');

  static obfuscateTag = Buffer.from('efefefef', 'hex');

  private tag: Buffer;

  obfuscateTag: Buffer;

  constructor(props: any) {
    super(props);
    this.tag = AbridgedPacketCodec.tag;
    this.obfuscateTag = AbridgedPacketCodec.obfuscateTag;
  }

  encodePacket(data: Buffer) {
    const length = data.length >> 2;
    let temp;
    if (length < 127) {
      const b = Buffer.alloc(1);
      b.writeUInt8(length, 0);
      temp = b;
    } else {
      temp = Buffer.concat([Buffer.from('7f', 'hex'), readBufferFromBigInt(BigInt(length), 3)]);
    }
    return Buffer.concat([temp, data]);
  }

  async readPacket(reader: PromisedWebSockets) {
    const readData = await reader.read(1);
    let length = readData[0];
    if (length >= 127) {
      length = Buffer.concat([await reader.read(3), Buffer.alloc(1)])
        .readInt32LE(0);
    }

    return reader.read(length << 2);
  }
}

/**
 * This is the mode with the lowest overhead, as it will
 * only require 1 byte if the packet length is less than
 * 508 bytes (127 << 2, which is very common).
 */
export class ConnectionTCPAbridged extends Connection {
  PacketCodecClass = AbridgedPacketCodec;
}
