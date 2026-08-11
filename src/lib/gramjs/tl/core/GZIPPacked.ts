import { gunzipSync, gzipSync } from 'fflate';

import type { BinaryReader } from '../../extensions';

import { concat, readUint32LE, writeUint32LE } from '../../../../util/encoding/buffer';
import { SecurityError } from '../../errors';
import { serializeBytes } from '..';

const MAX_GZIP_DATA_LENGTH = 64 * 1024 * 1024;
const GZIP_FOOTER_LENGTH = 8;

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
    if (input.length < GZIP_FOOTER_LENGTH) {
      throw new SecurityError('Gzip payload is too short');
    }
    if (input.length > MAX_GZIP_DATA_LENGTH) {
      throw new SecurityError('Gzip payload is too large');
    }

    // The gzip footer bounds allocation to the advertised output size
    // https://core.telegram.org/api/invoking#data-compression
    const outputLength = readUint32LE(input, input.length - 4);
    if (!outputLength || outputLength > MAX_GZIP_DATA_LENGTH) {
      throw new SecurityError('Unpacked gzip payload is too large');
    }

    const output = gunzipSync(input, { out: new Uint8Array(outputLength + 1) });
    if (output.length !== outputLength) {
      throw new SecurityError('Unpacked gzip payload has an invalid length');
    }

    return output;
  }

  toBytes() {
    const g = new Uint8Array(4);
    writeUint32LE(g, GZIPPacked.CONSTRUCTOR_ID);
    return concat(
      g,
      serializeBytes(GZIPPacked.gzip(this.data)),
    );
  }

  static fromReader(reader: BinaryReader) {
    const data = reader.tgReadBytes();
    return new GZIPPacked(GZIPPacked.ungzip(data));
  }
}
