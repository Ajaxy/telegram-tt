export type BufferEncoding =
  | 'ascii'
  | 'utf8'
  | 'utf-8'
  | 'utf16le'
  | 'ucs2'
  | 'base64'
  | 'base64url'
  | 'latin1'
  | 'binary'
  | 'hex';

// TODO: Migrate GramJS byte handling from `Buffer` to `Uint8Array` and remove this compatibility declaration.
export class Buffer<TArrayBuffer extends ArrayBuffer = ArrayBuffer> extends Uint8Array<TArrayBuffer> {
  static from<T extends ArrayBuffer>(arrayBuffer: T, byteOffset?: number, length?: number): Buffer<T>;
  static from<T extends ArrayBuffer>(array: ArrayBufferView<T>): Buffer<T>;
  static from(array: ArrayLike<number>): Buffer<ArrayBuffer>;
  static from(string: string, encoding?: BufferEncoding): Buffer<ArrayBuffer>;
  static alloc(size: number, fill?: string | Uint8Array | number, encoding?: BufferEncoding): Buffer<ArrayBuffer>;
  static allocUnsafe(size: number): Buffer<ArrayBuffer>;
  static concat(list: ReadonlyArray<Uint8Array>, totalLength?: number): Buffer<ArrayBuffer>;
  static isBuffer(value: unknown): value is Buffer<ArrayBuffer>;

  write(string: string, offset?: number, length?: number, encoding?: BufferEncoding): number;
  toString(encoding?: BufferEncoding, start?: number, end?: number): string;
  toJSON(): { type: 'Buffer'; data: number[] };
  equals(otherBuffer: Uint8Array): boolean;
  compare(
    otherBuffer: Uint8Array,
    targetStart?: number,
    targetEnd?: number,
    sourceStart?: number,
    sourceEnd?: number,
  ): number;
  copy(targetBuffer: Uint8Array, targetStart?: number, sourceStart?: number, sourceEnd?: number): number;
  slice(start?: number, end?: number): Buffer<TArrayBuffer>;
  subarray(start?: number, end?: number): Buffer<TArrayBuffer>;
  reverse(): this;
  swap16(): Buffer<TArrayBuffer>;
  swap32(): Buffer<TArrayBuffer>;
  swap64(): Buffer<TArrayBuffer>;

  readUIntLE(offset: number, byteLength: number, noAssert?: boolean): number;
  readUIntBE(offset: number, byteLength: number, noAssert?: boolean): number;
  readIntLE(offset: number, byteLength: number, noAssert?: boolean): number;
  readIntBE(offset: number, byteLength: number, noAssert?: boolean): number;
  readUInt8(offset: number, noAssert?: boolean): number;
  readUInt16LE(offset: number, noAssert?: boolean): number;
  readUInt16BE(offset: number, noAssert?: boolean): number;
  readUInt32LE(offset: number, noAssert?: boolean): number;
  readUInt32BE(offset: number, noAssert?: boolean): number;
  readBigUInt64LE(offset?: number): bigint;
  readBigUInt64BE(offset?: number): bigint;
  readInt8(offset: number, noAssert?: boolean): number;
  readInt16LE(offset: number, noAssert?: boolean): number;
  readInt16BE(offset: number, noAssert?: boolean): number;
  readInt32LE(offset: number, noAssert?: boolean): number;
  readInt32BE(offset: number, noAssert?: boolean): number;
  readBigInt64LE(offset?: number): bigint;
  readBigInt64BE(offset?: number): bigint;
  readFloatLE(offset: number, noAssert?: boolean): number;
  readFloatBE(offset: number, noAssert?: boolean): number;
  readDoubleLE(offset: number, noAssert?: boolean): number;
  readDoubleBE(offset: number, noAssert?: boolean): number;

  writeUIntLE(value: number, offset: number, byteLength: number, noAssert?: boolean): number;
  writeUIntBE(value: number, offset: number, byteLength: number, noAssert?: boolean): number;
  writeIntLE(value: number, offset: number, byteLength: number, noAssert?: boolean): number;
  writeIntBE(value: number, offset: number, byteLength: number, noAssert?: boolean): number;
  writeUInt8(value: number, offset: number, noAssert?: boolean): number;
  writeUInt16LE(value: number, offset: number, noAssert?: boolean): number;
  writeUInt16BE(value: number, offset: number, noAssert?: boolean): number;
  writeUInt32LE(value: number, offset: number, noAssert?: boolean): number;
  writeUInt32BE(value: number, offset: number, noAssert?: boolean): number;
  writeBigUInt64LE(value: bigint, offset?: number): number;
  writeBigUInt64BE(value: bigint, offset?: number): number;
  writeInt8(value: number, offset: number, noAssert?: boolean): number;
  writeInt16LE(value: number, offset: number, noAssert?: boolean): number;
  writeInt16BE(value: number, offset: number, noAssert?: boolean): number;
  writeInt32LE(value: number, offset: number, noAssert?: boolean): number;
  writeInt32BE(value: number, offset: number, noAssert?: boolean): number;
  writeBigInt64LE(value: bigint, offset?: number): number;
  writeBigInt64BE(value: bigint, offset?: number): number;
  writeFloatLE(value: number, offset: number, noAssert?: boolean): number;
  writeFloatBE(value: number, offset: number, noAssert?: boolean): number;
  writeDoubleLE(value: number, offset: number, noAssert?: boolean): number;
  writeDoubleBE(value: number, offset: number, noAssert?: boolean): number;
  fill(value: string | Uint8Array | number, offset?: number, end?: number, encoding?: BufferEncoding): this;
  indexOf(value: string | number | Uint8Array, byteOffset?: number, encoding?: BufferEncoding): number;
  lastIndexOf(value: string | number | Uint8Array, byteOffset?: number, encoding?: BufferEncoding): number;
  includes(value: string | number | Uint8Array, byteOffset?: number, encoding?: BufferEncoding): boolean;
}
