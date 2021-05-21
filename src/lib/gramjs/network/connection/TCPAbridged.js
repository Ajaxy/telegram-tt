const BigInt = require('big-integer');
const { readBufferFromBigInt } = require('../../Helpers');
const {
    Connection,
    PacketCodec,
} = require('./Connection');

class AbridgedPacketCodec extends PacketCodec {
    static tag = Buffer.from('ef', 'hex');

    static obfuscateTag = Buffer.from('efefefef', 'hex');

    constructor(props) {
        super(props);
        this.tag = AbridgedPacketCodec.tag;
        this.obfuscateTag = AbridgedPacketCodec.obfuscateTag;
    }

    encodePacket(data) {
        let length = data.length >> 2;
        if (length < 127) {
            const b = Buffer.alloc(1);
            b.writeUInt8(length, 0);
            length = b;
        } else {
            length = Buffer.concat([Buffer.from('7f', 'hex'), readBufferFromBigInt(BigInt(length), 3)]);
        }
        return Buffer.concat([length, data]);
    }

    async readPacket(reader) {
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
class ConnectionTCPAbridged extends Connection {
    PacketCodecClass = AbridgedPacketCodec;
}

module.exports = {
    ConnectionTCPAbridged,
    AbridgedPacketCodec,
};
