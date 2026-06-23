import { concat } from '../../../util/encoding/buffer';

export default class BinaryWriter {
  private readonly _buffers: Uint8Array[];

  constructor(stream: Uint8Array) {
    this._buffers = [stream];
  }

  write(buffer: Uint8Array) {
    this._buffers.push(buffer);
  }

  getValue(): Uint8Array {
    return concat(...this._buffers);
  }
}
