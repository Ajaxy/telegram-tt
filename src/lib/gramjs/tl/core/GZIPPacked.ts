import { gzipSync, gunzipSync } from 'fflate';

import type { BinaryReader } from '../../extensions';

import { serializeBytes } from '..';

import { concat, writeUint32LE } from '../../../../util/encoding/buffer';

export default class GZIPPacked {
  static CONSTRUCTOR_ID = 0x3072cfa1;

  static classType = 'constructor';

  data: Uint8Array;

  private CONSTRUCTOR_ID: number;

  private classType: string;

  constructor(data: Uint8Array) {
    this.data = data;
    this.CONSTRUCTOR_ID = 0x3072cfa1;
    this.classType = 'constructor';
  }

  static gzipIfNeeded(contentRelated: boolean, data: Uint8Array): Uint8Array {
    if (contentRelated && data.length > 512) {
      const gzipped = new GZIPPacked(data).toBytes();
      if (gzipped.length < data.length) {
        return gzipped;
      }
    }
    return data;
  }

  static gzip(input: Uint8Array): Uint8Array {
    return gzipSync(input);
  }

  static ungzip(input: Uint8Array): Uint8Array {
    return gunzipSync(input);
  }

  toBytes() {
    const g = new Uint8Array(4);
    writeUint32LE(g, GZIPPacked.CONSTRUCTOR_ID);
    return concat(
      g,
      serializeBytes(GZIPPacked.gzip(this.data)),
    );
  }

  static async fromReader(reader: BinaryReader) {
    const data = reader.tgReadBytes();
    return new GZIPPacked(GZIPPacked.ungzip(data));
  }
}
