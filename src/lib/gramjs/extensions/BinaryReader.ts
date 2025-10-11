import { TypeNotFoundError } from '../errors';
import { coreObjects } from '../tl/core';

import { readBigIntFromBuffer } from '../Helpers';
import { tlobjects } from '../tl/AllTLObjects';

export default class BinaryReader {
  private readonly stream: Buffer;

  private _last?: Buffer;

  offset: number;

  /**
     * Small utility class to read binary data.
     * @param data {Buffer}
     */
  constructor(data: Buffer) {
    this.stream = data;
    this._last = undefined;
    this.offset = 0;
  }

  // region Reading

  // "All numbers are written as little endian."
  // https://core.telegram.org/mtproto
  /**
     * Reads a single byte value.
     */
  readByte() {
    return this.read(1)[0];
  }

  /**
     * Reads an integer (4 bytes or 32 bits) value.
     * @param signed {Boolean}
     */
  readInt(signed = true) {
    let res;
    if (signed) {
      res = this.stream.readInt32LE(this.offset);
    } else {
      res = this.stream.readUInt32LE(this.offset);
    }
    this.offset += 4;
    return res;
  }

  /**
     * Reads a long integer (8 bytes or 64 bits) value.
     * @param signed
     * @returns {bigint}
     */
  readLong(signed = true) {
    return this.readLargeInt(64, signed);
  }

  /**
     * Reads a real floating point (4 bytes) value.
     * @returns {number}
     */
  readFloat() {
    return this.read(4).readFloatLE(0);
  }

  /**
     * Reads a real floating point (8 bytes) value.
     * @returns {number}
     */
  readDouble() {
    // was this a bug ? it should have been <d
    return this.read(8).readDoubleLE(0);
  }

  /**
     * Reads a n-bits long integer value.
     * @param bits
     * @param signed {Boolean}
     */
  readLargeInt(bits: number, signed = true) {
    const buffer = this.read(Math.floor(bits / 8));
    return readBigIntFromBuffer(buffer, true, signed);
  }

  /**
     * Read the given amount of bytes, or -1 to read all remaining.
     * @param length {number}
     * @param checkLength {boolean} whether to check if the length overflows or not.
     */
  read(length = -1) {
    if (length === -1) {
      length = this.stream.length - this.offset;
    }
    const result = this.stream.slice(this.offset, this.offset + length);
    this.offset += length;
    if (result.length !== length) {
      throw Error(
        // eslint-disable-next-line @stylistic/max-len
        `No more data left to read (need ${length}, got ${result.length}: ${result.toString()}); last read ${this._last?.toString()}`,
      );
    }
    this._last = result;
    return result;
  }

  /**
     * Gets the byte array representing the current buffer as a whole.
     * @returns {Buffer}
     */
  getBuffer() {
    return this.stream;
  }

  // endregion

  // region Telegram custom reading
  /**
     * Reads a Telegram-encoded byte array, without the need of
     * specifying its length.
     * @returns {Buffer}
     */
  tgReadBytes() {
    const firstByte = this.readByte();
    let padding;
    let length;
    if (firstByte === 254) {
      length = this.readByte() | (this.readByte() << 8) | (this.readByte() << 16);
      padding = length % 4;
    } else {
      length = firstByte;
      padding = (length + 1) % 4;
    }
    const data = this.read(length);

    if (padding > 0) {
      padding = 4 - padding;
      this.read(padding);
    }

    return data;
  }

  /**
     * Reads a Telegram-encoded string.
     * @returns {string}
     */
  tgReadString() {
    return this.tgReadBytes().toString('utf-8');
  }

  /**
     * Reads a Telegram boolean value.
     * @returns {boolean}
     */
  tgReadBool() {
    const value = this.readInt(false);
    if (value === 0x997275b5) {
      // boolTrue
      return true;
    } else if (value === 0xbc799737) {
      // boolFalse
      return false;
    } else {
      throw new Error(`Invalid boolean code ${value.toString(16)}`);
    }
  }

  /**
     * Reads and converts Unix time (used by Telegram)
     * into a Javascript {Date} object.
     * @returns {Date}
     */
  tgReadDate() {
    const value = this.readInt();
    return new Date(value * 1000);
  }

  /**
     * Reads a Telegram object.
     */
  tgReadObject(): any {
    const constructorId = this.readInt(false);

    let clazz = tlobjects[constructorId];
    if (clazz === undefined) {
      /**
             * The class was undefined, but there's still a
             * chance of it being a manually parsed value like bool!
             */
      const value = constructorId;
      if (value === 0x997275b5) {
        // boolTrue
        return true;
      } else if (value === 0xbc799737) {
        // boolFalse
        return false;
      } else if (value === 0x1cb5c415) {
        // Vector
        const temp = [];
        const length = this.readInt();
        for (let i = 0; i < length; i++) {
          temp.push(this.tgReadObject());
        }
        return temp;
      }

      clazz = coreObjects.get(constructorId);

      if (clazz === undefined) {
        // If there was still no luck, give up
        this.seek(-4); // Go back
        const pos = this.tellPosition();
        const error = new TypeNotFoundError(constructorId, this.read());
        this.setPosition(pos);
        throw error;
      }
    }
    return clazz.fromReader(this);
  }

  /**
     * Reads a vector (a list) of Telegram objects.
     * @returns {[Buffer]}
     */
  tgReadVector() {
    if (this.readInt(false) !== 0x1cb5c415) {
      throw new Error('Invalid constructor code, vector was expected');
    }
    const count = this.readInt();
    const temp = [];
    for (let i = 0; i < count; i++) {
      temp.push(this.tgReadObject());
    }
    return temp;
  }

  // endregion

  // region Position related

  /**
     * Tells the current position on the stream.
     * @returns {number}
     */
  tellPosition() {
    return this.offset;
  }

  /**
     * Sets the current position on the stream.
     * @param position
     */
  setPosition(position: number) {
    this.offset = position;
  }

  /**
     * Seeks the stream position given an offset from the current position.
     * The offset may be negative.
     * @param offset
     */
  seek(offset: number) {
    this.offset += offset;
  }

  // endregion
}
