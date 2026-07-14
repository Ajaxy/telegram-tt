const OGG_CRC_POLYNOMIAL = 0x04C11DB7;
const OGG_HEADER_TYPE_BOS = 0x02;
const OGG_HEADER_TYPE_EOS = 0x04;
const MAX_PAGE_SEGMENTS = 255;
const MAX_SEGMENT_LEN = 255;
const DEFAULT_PRE_SKIP = 312;
const DEFAULT_PAGE_GRANULARITY_SAMPLES = 48000;

const OGG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) {
      r = (r & 0x80000000) ? (((r << 1) >>> 0) ^ OGG_CRC_POLYNOMIAL) : ((r << 1) >>> 0);
    }
    table[i] = r >>> 0;
  }
  return table;
})();

export type OggOpusWriterOptions = {
  channels: number;
  inputSampleRate: number;
};

export default class OggOpusWriter {
  private channels: number;

  private inputSampleRate: number;

  private serial = (Math.random() * 0xFFFFFFFF) >>> 0;

  private pageSequence = 0;

  private granulePosition = 0;

  private pageBuffer: Uint8Array[] = [];

  private samplesInCurrentPage = 0;

  private chunks: Uint8Array[] = [];

  private isHeadersWritten = false;

  private isFinalized = false;

  constructor(options: OggOpusWriterOptions) {
    this.channels = options.channels;
    this.inputSampleRate = options.inputSampleRate;
  }

  setOpusHead(opusHead: Uint8Array) {
    if (this.isHeadersWritten) return;
    this.writeHeaderPagesWith(opusHead);
  }

  writePacket(packet: Uint8Array, durationSamples: number) {
    if (this.isFinalized) return;
    this.ensureHeadersWritten();

    this.pageBuffer.push(packet);
    this.samplesInCurrentPage += durationSamples;
    this.granulePosition += durationSamples;

    if (this.shouldFlushPage()) {
      this.flushDataPage(false);
    }
  }

  finalize(): Uint8Array {
    if (this.isFinalized) return this.concat();
    this.ensureHeadersWritten();
    this.flushDataPage(true);
    this.isFinalized = true;
    return this.concat();
  }

  snapshot(): Uint8Array {
    if (!this.isHeadersWritten) return new Uint8Array(0);

    const extraPage = this.buildPage(this.pageBuffer, this.granulePosition, OGG_HEADER_TYPE_EOS, this.pageSequence);

    let total = extraPage.length;
    for (let i = 0; i < this.chunks.length; i++) total += this.chunks[i].length;

    const out = new Uint8Array(total);
    let off = 0;
    for (let i = 0; i < this.chunks.length; i++) {
      out.set(this.chunks[i], off);
      off += this.chunks[i].length;
    }
    out.set(extraPage, off);
    return out;
  }

  private ensureHeadersWritten() {
    if (this.isHeadersWritten) return;
    this.writeHeaderPagesWith(buildOpusHead(this.channels, this.inputSampleRate));
  }

  private writeHeaderPagesWith(opusHead: Uint8Array) {
    // Per RFC 7845, granule position counts all decoded samples including the
    // pre-skip ones, so the count starts at the pre-skip value from `OpusHead`
    const view = new DataView(opusHead.buffer, opusHead.byteOffset, opusHead.byteLength);
    this.granulePosition = view.getUint16(10, true);

    this.emitPage([opusHead], 0, OGG_HEADER_TYPE_BOS);
    this.emitPage([buildOpusTags()], 0, 0);
    this.isHeadersWritten = true;
  }

  private shouldFlushPage(): boolean {
    if (this.pageBuffer.length >= MAX_PAGE_SEGMENTS) return true;
    if (this.samplesInCurrentPage >= DEFAULT_PAGE_GRANULARITY_SAMPLES) return true;

    let segmentCount = 0;
    for (let i = 0; i < this.pageBuffer.length; i++) {
      segmentCount += Math.floor(this.pageBuffer[i].length / MAX_SEGMENT_LEN) + 1;
      if (segmentCount >= MAX_PAGE_SEGMENTS) return true;
    }
    return false;
  }

  private flushDataPage(isEos: boolean) {
    if (!this.pageBuffer.length) {
      if (isEos) this.emitPage([], this.granulePosition, OGG_HEADER_TYPE_EOS);
      return;
    }
    this.emitPage(this.pageBuffer, this.granulePosition, isEos ? OGG_HEADER_TYPE_EOS : 0);
    this.pageBuffer = [];
    this.samplesInCurrentPage = 0;
  }

  private emitPage(packets: Uint8Array[], granulePos: number, headerType: number) {
    const page = this.buildPage(packets, granulePos, headerType, this.pageSequence++);
    this.chunks.push(page);
  }

  private buildPage(packets: Uint8Array[], granulePos: number, headerType: number, pageSequence: number): Uint8Array {
    const segments: number[] = [];
    let payloadLen = 0;
    for (let i = 0; i < packets.length; i++) {
      const len = packets[i].length;
      const full = Math.floor(len / MAX_SEGMENT_LEN);
      for (let j = 0; j < full; j++) segments.push(MAX_SEGMENT_LEN);
      segments.push(len % MAX_SEGMENT_LEN);
      payloadLen += len;
    }

    const segCount = segments.length;
    const page = new Uint8Array(27 + segCount + payloadLen);
    const view = new DataView(page.buffer);

    page.set([0x4F, 0x67, 0x67, 0x53], 0); // 'OggS'
    page[4] = 0;
    page[5] = headerType;
    view.setUint32(6, granulePos >>> 0, true);
    view.setUint32(10, Math.floor(granulePos / 0x100000000) >>> 0, true);
    view.setUint32(14, this.serial, true);
    view.setUint32(18, pageSequence, true);
    view.setUint32(22, 0, true);
    page[26] = segCount;
    for (let i = 0; i < segCount; i++) page[27 + i] = segments[i];

    let off = 27 + segCount;
    for (let i = 0; i < packets.length; i++) {
      page.set(packets[i], off);
      off += packets[i].length;
    }

    view.setUint32(22, calculateOggCrc(page), true);
    return page;
  }

  private concat(): Uint8Array {
    let total = 0;
    for (let i = 0; i < this.chunks.length; i++) total += this.chunks[i].length;
    const out = new Uint8Array(total);
    let off = 0;
    for (let i = 0; i < this.chunks.length; i++) {
      out.set(this.chunks[i], off);
      off += this.chunks[i].length;
    }
    return out;
  }
}

function calculateOggCrc(bytes: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < bytes.length; i++) {
    crc = (((crc << 8) >>> 0) ^ OGG_CRC_TABLE[((crc >>> 24) ^ bytes[i]) & 0xFF]) >>> 0;
  }
  return crc >>> 0;
}

function buildOpusHead(channels: number, inputSampleRate: number): Uint8Array {
  const head = new Uint8Array(19);
  const view = new DataView(head.buffer);
  head.set([0x4F, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0); // 'OpusHead'
  head[8] = 1;
  head[9] = channels;
  view.setUint16(10, DEFAULT_PRE_SKIP, true);
  view.setUint32(12, inputSampleRate, true);
  view.setInt16(16, 0, true);
  head[18] = 0;
  return head;
}

function buildOpusTags(): Uint8Array {
  const vendor = new TextEncoder().encode('telegram-web-a');
  const tags = new Uint8Array(8 + 4 + vendor.length + 4);
  const view = new DataView(tags.buffer);
  tags.set([0x4F, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73], 0); // 'OpusTags'
  view.setUint32(8, vendor.length, true);
  tags.set(vendor, 12);
  view.setUint32(12 + vendor.length, 0, true); // 0 user comments
  return tags;
}
