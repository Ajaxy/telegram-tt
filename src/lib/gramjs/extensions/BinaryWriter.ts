export default class BinaryWriter {
    private readonly _buffers: Buffer[];

    constructor(stream: Buffer) {
        this._buffers = [stream];
    }

    write(buffer: Buffer) {
        this._buffers.push(buffer);
    }

    getValue(): Buffer {
        return Buffer.concat(this._buffers);
    }
}
