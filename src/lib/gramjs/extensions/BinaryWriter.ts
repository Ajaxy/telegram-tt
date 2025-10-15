export default class BinaryWriter {
  private readonly _buffers: Buffer<ArrayBuffer>[];

  constructor(stream: Buffer<ArrayBuffer>) {
    this._buffers = [stream];
  }

  write(buffer: Buffer<ArrayBuffer>) {
    this._buffers.push(buffer);
  }

  getValue(): Buffer<ArrayBuffer> {
    return Buffer.concat(this._buffers);
  }
}
