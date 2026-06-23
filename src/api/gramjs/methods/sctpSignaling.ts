import { DEBUG_CALLS } from '../../../config';
import {
  buffersEqual, concat, copy, readUint32BE, readUint32LE, writeUint32LE,
} from '../../../util/encoding/buffer';

type SctpChunk = {
  type: number;
  flags: number;
  body: Uint8Array;
};

type SctpDataChunk = {
  flags: number;
  body: Uint8Array;
};

const SCTP_PORT = 5000;
const SCTP_RECEIVE_WINDOW = 0x500000;
const SCTP_MAX_PENDING_PEER_DATA_CHUNKS = 256;
const SCTP_MAX_PENDING_PEER_DATA_BYTES = 0x100000;
const SCTP_MAX_PENDING_PEER_TSN_GAP = 1024;
const SCTP_INIT_RETRY_DELAY = 1000;
const SCTP_MAX_INIT_RETRY_DELAY = 8000;
const SCTP_STREAM_ID = 0;
const SCTP_BINARY_PPID = 53;
const SCTP_INIT = 1;
const SCTP_INIT_ACK = 2;
const SCTP_SACK = 3;
const SCTP_HEARTBEAT = 4;
const SCTP_HEARTBEAT_ACK = 5;
const SCTP_ABORT = 6;
const SCTP_STATE_COOKIE = 7;
const SCTP_COOKIE_ECHO = 10;
const SCTP_COOKIE_ACK = 11;
const SCTP_DATA = 0;

const CRC32C_TABLE = createCrc32cTable();

export class SctpSignaling {
  private localTag = generateUint32();

  private localTsn = generateUint32();

  private localSsn = 0;

  private peerTag?: number;

  private peerInitialTsn?: number;

  private peerCumulativeTsn?: number;

  private initSent = false;

  private initSentAt = 0;

  private initRetryCount = 0;

  private isEstablished = false;

  private cookie = new Uint8Array(0);

  private pendingPayloads: Uint8Array[] = [];

  private pendingPackets: number[][] = [];

  private pendingPeerData = new Map<number, SctpDataChunk>();

  private pendingPeerDataSize = 0;

  private reassembly?: Uint8Array[];

  wrapPayload(payload: Uint8Array) {
    if (this.isEstablished && this.peerTag !== undefined) {
      return Array.from(this.createDataPacket(payload));
    }

    this.pendingPayloads.push(payload);
    if (!this.initSent) {
      return this.createInitRetryPacket();
    }

    if (this.shouldRetryInit()) {
      logSctp('INIT retrying', {
        retryCount: this.initRetryCount,
        pendingPayloadCount: this.pendingPayloads.length,
      });
      return this.createInitRetryPacket();
    }

    return undefined;
  }

  private shouldRetryInit() {
    if (!this.initSentAt || this.peerTag !== undefined) {
      return false;
    }

    return Date.now() - this.initSentAt >= this.getInitRetryDelay();
  }

  private getInitRetryDelay() {
    if (!this.initRetryCount) {
      return SCTP_INIT_RETRY_DELAY;
    }

    return Math.min(SCTP_INIT_RETRY_DELAY * 2 ** (this.initRetryCount - 1), SCTP_MAX_INIT_RETRY_DELAY);
  }

  private createInitRetryPacket() {
    this.initSent = true;
    this.initSentAt = Date.now();
    this.initRetryCount++;
    return Array.from(this.createInitPacket());
  }

  drainPackets() {
    const result = this.pendingPackets;
    this.pendingPackets = [];
    return result;
  }

  receive(packet: Uint8Array) {
    const payloads: Uint8Array[] = [];
    if (packet.length < 12) {
      logSctp('packet dropped: too short', {
        length: packet.length,
      });
      return payloads;
    }

    if (!hasValidSctpChecksum(packet)) {
      logSctp('packet dropped: invalid CRC32C', {
        length: packet.length,
        sourcePort: new DataView(packet.buffer, packet.byteOffset, packet.byteLength).getUint16(0, false),
        destinationPort: new DataView(packet.buffer, packet.byteOffset, packet.byteLength).getUint16(2, false),
        verificationTag: readUint32BE(packet, 4),
      });
      return payloads;
    }

    const chunks = parseSctpChunks(packet);
    chunks.forEach((chunk) => {
      if (!this.validateVerificationTag(packet, chunk.type)) {
        logSctp('chunk dropped: invalid verification tag', {
          chunkType: chunk.type,
          verificationTag: readUint32BE(packet, 4),
          expectedVerificationTag: chunk.type === SCTP_INIT ? 0 : this.localTag,
        });
        return;
      }

      if (chunk.type === SCTP_INIT) {
        this.handleInit(chunk.body);
      } else if (chunk.type === SCTP_INIT_ACK) {
        this.handleInitAck(chunk.body);
      } else if (chunk.type === SCTP_COOKIE_ECHO) {
        if (!this.validateCookieEcho(chunk.body)) {
          logSctp('COOKIE_ECHO ignored: invalid cookie', {
            cookieLength: chunk.body.length,
            expectedCookieLength: this.cookie.length,
          });
          return;
        }
        this.pendingPackets.push(Array.from(this.createPacket(SCTP_COOKIE_ACK, 0, new Uint8Array(0))));
        this.markEstablished();
      } else if (chunk.type === SCTP_COOKIE_ACK) {
        this.markEstablished();
      } else if (chunk.type === SCTP_DATA) {
        payloads.push(...this.handleData(chunk.flags, chunk.body));
      } else if (chunk.type === SCTP_SACK) {
        this.handleSack(chunk.body);
      } else if (chunk.type === SCTP_HEARTBEAT) {
        this.pendingPackets.push(Array.from(this.createPacket(SCTP_HEARTBEAT_ACK, 0, chunk.body)));
      } else if (chunk.type === SCTP_HEARTBEAT_ACK) {
        // Nothing to do; accepting the chunk prevents Firefox/native peers from being logged as unsupported.
      } else if (chunk.type === SCTP_ABORT) {
        logSctp('ABORT received; resetting association', {
          bodyLength: chunk.body.length,
        });
        this.resetAssociation();
      } else {
        logSctp('chunk ignored: unsupported type', {
          chunkType: chunk.type,
          flags: chunk.flags,
          bodyLength: chunk.body.length,
        });
      }
    });

    return payloads;
  }

  private validateCookieEcho(cookie: Uint8Array) {
    return Boolean(this.cookie.length && buffersEqual(cookie, this.cookie));
  }

  private validateVerificationTag(packet: Uint8Array, chunkType: number) {
    const verificationTag = readUint32BE(packet, 4);
    if (chunkType === SCTP_INIT) {
      return verificationTag === 0;
    }

    return verificationTag === this.localTag;
  }

  private handleInit(body: Uint8Array) {
    if (body.length < 16) {
      logSctp('INIT ignored: body too short', {
        bodyLength: body.length,
      });
      return;
    }

    const bodyView = new DataView(body.buffer, body.byteOffset, body.byteLength);
    this.peerTag = bodyView.getUint32(0, false);
    this.peerInitialTsn = bodyView.getUint32(12, false);
    this.peerCumulativeTsn = (this.peerInitialTsn - 1) >>> 0;
    this.initSent = true;
    this.cookie = this.createCookie();
    this.pendingPackets.push(Array.from(this.createInitAckPacket()));
  }

  private handleInitAck(body: Uint8Array) {
    if (body.length < 16) {
      logSctp('INIT_ACK ignored: body too short', {
        bodyLength: body.length,
      });
      return;
    }

    const bodyView = new DataView(body.buffer, body.byteOffset, body.byteLength);
    this.peerTag = bodyView.getUint32(0, false);
    this.peerInitialTsn = bodyView.getUint32(12, false);
    this.peerCumulativeTsn = (this.peerInitialTsn - 1) >>> 0;

    const cookie = findSctpParameter(body.slice(16), SCTP_STATE_COOKIE);
    if (cookie) {
      this.pendingPackets.push(Array.from(this.createPacket(SCTP_COOKIE_ECHO, 0, cookie)));
    } else {
      logSctp('INIT_ACK ignored: missing state cookie', {
        bodyLength: body.length,
      });
    }
  }

  private handleData(flags: number, body: Uint8Array) {
    if (body.length < 12) {
      logSctp('DATA ignored: body too short', {
        bodyLength: body.length,
      });
      return [];
    }

    const bodyView = new DataView(body.buffer, body.byteOffset, body.byteLength);
    const tsn = bodyView.getUint32(0, false);
    const streamId = bodyView.getUint16(4, false);
    const ppid = bodyView.getUint32(8, false);
    if (streamId !== SCTP_STREAM_ID || ppid !== SCTP_BINARY_PPID) {
      logSctp('DATA ignored: unsupported stream or PPID', {
        streamId,
        ppid,
        expectedStreamId: SCTP_STREAM_ID,
        expectedPpid: SCTP_BINARY_PPID,
      });
      return [];
    }

    const expectedTsn = this.getNextPeerTsn();
    if (expectedTsn !== undefined && tsn !== expectedTsn) {
      if (isTsnAfter(tsn, expectedTsn)) {
        this.bufferPendingPeerData(tsn, flags, body, expectedTsn);
      } else {
        logSctp('DATA ignored: duplicate TSN', {
          tsn,
          peerCumulativeTsn: this.peerCumulativeTsn,
          expectedTsn,
        });
      }
      this.pendingPackets.push(Array.from(this.createSackPacket()));
      return [];
    }

    return this.acceptData(tsn, flags, body);
  }

  private acceptData(tsn: number, flags: number, body: Uint8Array) {
    const payloads: Uint8Array[] = [];
    let currentTsn = tsn;
    let currentFlags = flags;
    let currentBody = body;

    while (true) {
      const payload = this.readDataPayload(currentTsn, currentFlags, currentBody);
      if (payload) {
        payloads.push(payload);
      }

      const nextTsn = this.getNextPeerTsn();
      const nextChunk = nextTsn === undefined ? undefined : this.pendingPeerData.get(nextTsn);
      if (nextTsn === undefined || !nextChunk) {
        break;
      }

      this.deletePendingPeerData(nextTsn);
      currentTsn = nextTsn;
      currentFlags = nextChunk.flags;
      currentBody = nextChunk.body;
    }

    this.pendingPackets.push(Array.from(this.createSackPacket()));
    return payloads;
  }

  private readDataPayload(tsn: number, flags: number, body: Uint8Array) {
    this.markEstablished();
    this.peerCumulativeTsn = tsn;

    const userData = body.slice(12);
    const isBegin = Boolean(flags & 0x02);
    const isEnd = Boolean(flags & 0x01);
    if (isBegin && isEnd) {
      return userData;
    }

    if (isBegin) {
      this.reassembly = [userData];
      return undefined;
    }

    if (!this.reassembly) {
      logSctp('DATA ignored: missing reassembly start', {
        flags,
        tsn,
      });
      return undefined;
    }

    this.reassembly.push(userData);
    if (!isEnd) {
      return undefined;
    }

    const result = concat(...this.reassembly);
    this.reassembly = undefined;
    return result;
  }

  private handleSack(body: Uint8Array) {
    if (body.length < 12) {
      logSctp('SACK ignored: body too short', {
        bodyLength: body.length,
      });
      return;
    }

    this.markEstablished();
  }

  private getNextPeerTsn() {
    if (this.peerCumulativeTsn === undefined) {
      return undefined;
    }

    return (this.peerCumulativeTsn + 1) >>> 0;
  }

  private bufferPendingPeerData(tsn: number, flags: number, body: Uint8Array, expectedTsn: number) {
    if (this.pendingPeerData.has(tsn)) {
      logSctp('DATA ignored: already buffered TSN', {
        tsn,
        expectedTsn,
        pendingCount: this.pendingPeerData.size,
        pendingBytes: this.pendingPeerDataSize,
      });
      return;
    }

    const tsnGap = getForwardTsnGap(tsn, expectedTsn);
    if (
      tsnGap > SCTP_MAX_PENDING_PEER_TSN_GAP
      || this.pendingPeerData.size >= SCTP_MAX_PENDING_PEER_DATA_CHUNKS
      || this.pendingPeerDataSize + body.length > SCTP_MAX_PENDING_PEER_DATA_BYTES
    ) {
      logSctp('DATA ignored: TSN gap buffer full', {
        tsn,
        peerCumulativeTsn: this.peerCumulativeTsn,
        expectedTsn,
        tsnGap,
        pendingCount: this.pendingPeerData.size,
        pendingBytes: this.pendingPeerDataSize,
      });
      return;
    }

    this.pendingPeerData.set(tsn, { flags, body });
    this.pendingPeerDataSize += body.length;
    logSctp('DATA buffered: TSN gap', {
      tsn,
      peerCumulativeTsn: this.peerCumulativeTsn,
      expectedTsn,
      tsnGap,
      pendingCount: this.pendingPeerData.size,
      pendingBytes: this.pendingPeerDataSize,
    });
  }

  private deletePendingPeerData(tsn: number) {
    const chunk = this.pendingPeerData.get(tsn);
    if (!chunk) {
      return;
    }

    this.pendingPeerDataSize -= chunk.body.length;
    this.pendingPeerData.delete(tsn);
  }

  private clearPendingPeerData() {
    this.pendingPeerData.clear();
    this.pendingPeerDataSize = 0;
  }

  private flushPendingPayloads() {
    if (this.peerTag === undefined) {
      return;
    }

    const payloads = this.pendingPayloads;
    this.pendingPayloads = [];
    payloads.forEach((payload) => {
      this.pendingPackets.push(Array.from(this.createDataPacket(payload)));
    });
  }

  private markEstablished() {
    if (this.isEstablished) {
      return;
    }

    this.isEstablished = true;
    this.flushPendingPayloads();
  }

  private resetAssociation() {
    this.localTag = generateUint32();
    this.localTsn = generateUint32();
    this.localSsn = 0;
    this.peerTag = undefined;
    this.peerInitialTsn = undefined;
    this.peerCumulativeTsn = undefined;
    this.initSent = false;
    this.initSentAt = 0;
    this.initRetryCount = 0;
    this.isEstablished = false;
    this.cookie = new Uint8Array(0);
    this.pendingPayloads = [];
    this.pendingPackets = [];
    this.clearPendingPeerData();
    this.reassembly = undefined;
  }

  private createInitPacket() {
    const body = new Uint8Array(16);
    const bodyView = new DataView(body.buffer);
    bodyView.setUint32(0, this.localTag, false);
    bodyView.setUint32(4, SCTP_RECEIVE_WINDOW, false);
    bodyView.setUint16(8, 0xFFFF, false);
    bodyView.setUint16(10, 0xFFFF, false);
    bodyView.setUint32(12, this.localTsn, false);
    return this.createPacket(SCTP_INIT, 0, body, 0);
  }

  private createInitAckPacket() {
    const body = new Uint8Array(16);
    const bodyView = new DataView(body.buffer);
    bodyView.setUint32(0, this.localTag, false);
    bodyView.setUint32(4, SCTP_RECEIVE_WINDOW, false);
    bodyView.setUint16(8, 0xFFFF, false);
    bodyView.setUint16(10, 0xFFFF, false);
    bodyView.setUint32(12, this.localTsn, false);

    return this.createPacket(SCTP_INIT_ACK, 0, concat(
      body,
      createSctpParameter(SCTP_STATE_COOKIE, this.cookie),
    ));
  }

  private createDataPacket(payload: Uint8Array) {
    const body = new Uint8Array(12 + payload.length);
    const bodyView = new DataView(body.buffer);
    bodyView.setUint32(0, this.localTsn, false);
    this.localTsn = (this.localTsn + 1) >>> 0;
    bodyView.setUint16(4, SCTP_STREAM_ID, false);
    bodyView.setUint16(6, this.localSsn, false);
    this.localSsn = (this.localSsn + 1) & 0xFFFF;
    bodyView.setUint32(8, SCTP_BINARY_PPID, false);
    body.set(payload, 12);
    return this.createPacket(SCTP_DATA, 0x03, body);
  }

  private createSackPacket() {
    const body = new Uint8Array(12);
    const bodyView = new DataView(body.buffer);
    bodyView.setUint32(0, this.peerCumulativeTsn || 0, false);
    bodyView.setUint32(4, SCTP_RECEIVE_WINDOW, false);
    bodyView.setUint16(8, 0, false);
    bodyView.setUint16(10, 0, false);
    return this.createPacket(SCTP_SACK, 0, body);
  }

  private createPacket(type: number, flags: number, body: Uint8Array, verificationTag = this.peerTag || 0) {
    const chunk = createSctpChunk(type, flags, body);
    const packet = new Uint8Array(12 + chunk.length);
    const packetView = new DataView(packet.buffer);
    packetView.setUint16(0, SCTP_PORT, false);
    packetView.setUint16(2, SCTP_PORT, false);
    packetView.setUint32(4, verificationTag, false);
    packet.set(chunk, 12);
    packetView.setUint32(8, crc32c(packet), true);
    return packet;
  }

  private createCookie() {
    const cookie = new Uint8Array(16);
    const cookieView = new DataView(cookie.buffer);
    cookieView.setUint32(0, this.localTag, false);
    cookieView.setUint32(4, this.peerTag || 0, false);
    cookieView.setUint32(8, this.localTsn, false);
    cookieView.setUint32(12, this.peerInitialTsn || 0, false);
    return cookie;
  }
}

function createSctpChunk(type: number, flags: number, body: Uint8Array) {
  const length = 4 + body.length;
  const paddedLength = align4(length);
  const chunk = new Uint8Array(paddedLength);
  const chunkView = new DataView(chunk.buffer);
  chunk[0] = type;
  chunk[1] = flags;
  chunkView.setUint16(2, length, false);
  chunk.set(body, 4);
  return chunk;
}

function createSctpParameter(type: number, value: Uint8Array) {
  const length = 4 + value.length;
  const parameter = new Uint8Array(align4(length));
  const parameterView = new DataView(parameter.buffer);
  parameterView.setUint16(0, type, false);
  parameterView.setUint16(2, length, false);
  parameter.set(value, 4);
  return parameter;
}

function findSctpParameter(parameters: Uint8Array, type: number) {
  const parametersView = new DataView(parameters.buffer, parameters.byteOffset, parameters.byteLength);
  let offset = 0;
  while (offset + 4 <= parameters.length) {
    const parameterType = parametersView.getUint16(offset, false);
    const length = parametersView.getUint16(offset + 2, false);
    if (length < 4 || offset + length > parameters.length) {
      return undefined;
    }

    if (parameterType === type) {
      return parameters.slice(offset + 4, offset + length);
    }

    offset += align4(length);
  }

  return undefined;
}

function parseSctpChunks(packet: Uint8Array) {
  const chunks: SctpChunk[] = [];
  const packetView = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  let offset = 12;
  while (offset + 4 <= packet.length) {
    const type = packet[offset];
    const flags = packet[offset + 1];
    const length = packetView.getUint16(offset + 2, false);
    if (length < 4 || offset + length > packet.length) {
      break;
    }

    chunks.push({
      type,
      flags,
      body: packet.slice(offset + 4, offset + length),
    });
    offset += align4(length);
  }

  return chunks;
}

export function isSctpPacket(packet: Uint8Array) {
  if (packet.length < 12) {
    return false;
  }
  const packetView = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  return packet.length >= 12
    && packetView.getUint16(0, false) === SCTP_PORT
    && packetView.getUint16(2, false) === SCTP_PORT;
}

function hasValidSctpChecksum(packet: Uint8Array) {
  return isSctpPacket(packet)
    && readUint32LE(packet, 8) === crc32c(packet);
}

function align4(value: number) {
  return (value + 3) & ~3;
}

function generateUint32() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);

  return values[0] >>> 0;
}

function isTsnAfter(tsn: number, expectedTsn: number) {
  return ((tsn - expectedTsn) >>> 0) < 0x80000000;
}

function getForwardTsnGap(tsn: number, expectedTsn: number) {
  return (tsn - expectedTsn) >>> 0;
}

function createCrc32cTable() {
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? (0x82F63B78 ^ (value >>> 1)) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
}

function crc32c(data: Uint8Array) {
  const buffer = copy(data);
  writeUint32LE(buffer, 0, 8);
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC32C_TABLE[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (~crc) >>> 0;
}

function logSctp(message: string, data: Record<string, unknown> = {}) {
  if (!DEBUG_CALLS) {
    return;
  }

  // eslint-disable-next-line no-console
  console.debug(`[PhoneCall][SCTP] ${message}`, data);
}
