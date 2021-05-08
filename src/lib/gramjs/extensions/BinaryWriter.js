class BinaryWriter {
    constructor(stream) {
        this._stream = stream;
    }

    write(buffer) {
        this._stream = Buffer.concat([this._stream, buffer]);
    }

    getValue() {
        return this._stream;
    }
}

module.exports = BinaryWriter;
