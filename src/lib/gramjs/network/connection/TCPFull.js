// CONTEST
// const { Connection, PacketCodec } = require('./Connection')
// const { crc32 } = require('../../Helpers')
// const { InvalidChecksumError } = require('../../errors/Common')
//
// class FullPacketCodec extends PacketCodec {
//     constructor(connection) {
//         super(connection)
//         this._sendCounter = 0 // Telegram will ignore us otherwise
//     }
//
//     encodePacket(data) {
//         // https://core.telegram.org/mtproto#tcp-transport
//         // total length, sequence number, packet and checksum (CRC32)
//         const length = data.length + 12
//         const e = Buffer.alloc(8)
//         e.writeInt32LE(length,0)
//         e.writeInt32LE(this._sendCounter,4)
//         data = Buffer.concat([e, data])
//         const crc =  Buffer.alloc(4)
//         crc.writeUInt32LE(crc32(data),0)
//         this._sendCounter += 1
//         return Buffer.concat([data, crc])
//     }
//
//     /**
//      *
//      * @param reader {PromisedWebSockets}
//      * @returns {Promise<*>}
//      */
//     async readPacket(reader) {
//         const packetLenSeq = await reader.read(8) // 4 and 4
//         // process.exit(0);
//         if (packetLenSeq === undefined) {
//             return false
//         }
//         const packetLen = packetLenSeq.readInt32LE(0)
//         let body = await reader.read(packetLen - 8)
//         const [checksum] = body.slice(-4).readUInt32LE(0)
//         body = body.slice(0, -4)
//
//         const validChecksum = crc32(Buffer.concat([packetLenSeq, body]))
//         if (!(validChecksum === checksum)) {
//             throw new InvalidChecksumError(checksum, validChecksum)
//         }
//         return body
//     }
// }
//
// class ConnectionTCPFull extends Connection {
//     PacketCodecClass = FullPacketCodec;
// }
//
// module.exports = {
//     FullPacketCodec,
//     ConnectionTCPFull,
// }
