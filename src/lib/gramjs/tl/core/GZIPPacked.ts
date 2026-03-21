import { gzipSync, gunzipSync } from 'fflate';

import type { BinaryReader } from '../../extensions';

import { serializeBytes } from '..';

export default class GZIPPacked {
  static CONSTRUCTOR_ID = 0x3072cfa1;

  static classType = 'constructor';

  data: Buffer<ArrayBuffer>;

  private CONSTRUCTOR_ID: number;

  private classType: string;

  constructor(data: Buffer<ArrayBuffer>) {
    this.data = data;
    this.CONSTRUCTOR_ID = 0x3072cfa1;
    this.classType = 'constructor';
  }

  static gzipIfNeeded(contentRelated: boolean, data: Buffer<ArrayBuffer>) {
    if (contentRelated && data.length > 512) {
      const gzipped = new GZIPPacked(data).toBytes();
      if (gzipped.length < data.length) {
        return gzipped;
      }
    }
    return data;
  }

  static gzip(input: Buffer<ArrayBuffer>) {
    return Buffer.from(gzipSync(input));
  }

  static ungzip(input: Buffer) {
    return Buffer.from(gunzipSync(input));
  }

  toBytes() {
    const g = Buffer.alloc(4);
    g.writeUInt32LE(GZIPPacked.CONSTRUCTOR_ID, 0);
    return Buffer.concat([
      g,
      serializeBytes(GZIPPacked.gzip(this.data)),
    ]);
  }

  static async fromReader(reader: BinaryReader) {
    const data = reader.tgReadBytes();
    return new GZIPPacked(GZIPPacked.ungzip(data));
  }
}
