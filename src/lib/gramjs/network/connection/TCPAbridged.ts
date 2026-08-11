import type { PromisedWebSockets } from '../../extensions';

import { bufferFromHex, concat, readUint32LE } from '../../../../util/encoding/buffer';
import { SecurityError } from '../../errors';

import { readBufferFromBigInt } from '../../Helpers';
import { Connection, PacketCodec } from './Connection';

const TL_ALIGNMENT = 4;
const MAX_ABRIDGED_PACKET_LENGTH = 0xFFFFFF * TL_ALIGNMENT;

export class AbridgedPacketCodec extends PacketCodec {
  static tag = bufferFromHex('ef');

  static obfuscateTag = bufferFromHex('efefefef');

  private tag: Uint8Array;

  obfuscateTag: Uint8Array;

  constructor(props: any) {
    super(props);
    this.tag = AbridgedPacketCodec.tag;
    this.obfuscateTag = AbridgedPacketCodec.obfuscateTag;
  }

  encodePacket(data: Uint8Array) {
    if (
      !data.length
      || data.length % TL_ALIGNMENT !== 0
      || data.length > MAX_ABRIDGED_PACKET_LENGTH
    ) {
      throw new SecurityError('Invalid abridged packet length');
    }

    const length = data.length >> 2;
    let temp;
    if (length < 127) {
      temp = new Uint8Array([length]);
    } else {
      temp = concat(bufferFromHex('7f'), readBufferFromBigInt(BigInt(length), 3));
    }
    return concat(temp, data);
  }

  async readPacket(reader: PromisedWebSockets) {
    const readData = await reader.read(1);
    let length = readData[0];
    if (length >= 127) {
      const lengthBytes = new Uint8Array(4);
      lengthBytes.set(await reader.read(3));
      length = readUint32LE(lengthBytes);
    }

    const packetLength = length * TL_ALIGNMENT;
    // The three-byte word count bounds allocation before the payload is read
    // https://core.telegram.org/mtproto/mtproto-transports#abridged
    if (!packetLength || packetLength > MAX_ABRIDGED_PACKET_LENGTH) {
      throw new SecurityError('Invalid abridged packet length');
    }

    return reader.read(packetLength);
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
