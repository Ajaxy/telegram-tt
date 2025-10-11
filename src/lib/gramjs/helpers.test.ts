import {
  readBigIntFromBuffer,
  readBufferFromBigInt,
  toSignedLittleBuffer,
} from './Helpers';

describe('readBigIntFromBuffer', () => {
  describe('little endian unsigned', () => {
    it('should read 8-byte buffer using native method', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
      const result = readBigIntFromBuffer(buffer, true, false);
      expect(result).toBe(0x0807060504030201n);
    });

    it('should read 4-byte buffer', () => {
      const buffer = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]);
      const result = readBigIntFromBuffer(buffer, true, false);
      expect(result).toBe(0xFFFFFFFFn);
    });

    it('should read 2-byte buffer', () => {
      const buffer = Buffer.from([0x34, 0x12]);
      const result = readBigIntFromBuffer(buffer, true, false);
      expect(result).toBe(0x1234n);
    });
  });

  describe('big endian unsigned', () => {
    it('should read 8-byte buffer using native method', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
      const result = readBigIntFromBuffer(buffer, false, false);
      expect(result).toBe(0x0102030405060708n);
    });

    it('should read 4-byte buffer', () => {
      const buffer = Buffer.from([0x12, 0x34, 0x56, 0x78]);
      const result = readBigIntFromBuffer(buffer, false, false);
      expect(result).toBe(0x12345678n);
    });
  });

  describe('signed values', () => {
    it('should read positive signed 8-byte value', () => {
      const buffer = Buffer.from([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      const result = readBigIntFromBuffer(buffer, true, true);
      expect(result).toBe(1n);
    });

    it('should read negative signed 8-byte value', () => {
      const buffer = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
      const result = readBigIntFromBuffer(buffer, true, true);
      expect(result).toBe(-1n);
    });

    it('should read negative signed 4-byte value', () => {
      const buffer = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]);
      const result = readBigIntFromBuffer(buffer, true, true);
      expect(result).toBe(-1n);
    });

    it('should read max signed 8-byte value', () => {
      const buffer = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x7F]);
      const result = readBigIntFromBuffer(buffer, true, true);
      expect(result).toBe(0x7FFFFFFFFFFFFFFFn);
    });

    it('should read min signed 8-byte value', () => {
      const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80]);
      const result = readBigIntFromBuffer(buffer, true, true);
      expect(result).toBe(-0x8000000000000000n);
    });
  });
});

describe('toSignedLittleBuffer', () => {
  describe('8-byte buffers (native method)', () => {
    it('should convert positive value', () => {
      const buffer = toSignedLittleBuffer(0x0102030405060708n, 8);
      expect(buffer).toEqual(Buffer.from([0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01]));
    });

    it('should convert negative value', () => {
      const buffer = toSignedLittleBuffer(-1n, 8);
      expect(buffer).toEqual(Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]));
    });

    it('should convert zero', () => {
      const buffer = toSignedLittleBuffer(0n, 8);
      expect(buffer).toEqual(Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
    });

    it('should convert max signed 64-bit value', () => {
      const buffer = toSignedLittleBuffer(0x7FFFFFFFFFFFFFFFn, 8);
      expect(buffer).toEqual(Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x7F]));
    });

    it('should convert min signed 64-bit value', () => {
      const buffer = toSignedLittleBuffer(-0x8000000000000000n, 8);
      expect(buffer).toEqual(Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80]));
    });
  });

  describe('non-8-byte buffers', () => {
    it('should convert 4-byte value', () => {
      const buffer = toSignedLittleBuffer(0x12345678n, 4);
      expect(buffer).toEqual(Buffer.from([0x78, 0x56, 0x34, 0x12]));
    });

    it('should convert 2-byte value', () => {
      const buffer = toSignedLittleBuffer(0x1234n, 2);
      expect(buffer).toEqual(Buffer.from([0x34, 0x12]));
    });

    it('should convert 16-byte value', () => {
      const buffer = toSignedLittleBuffer(0x0102030405060708090A0B0C0D0E0F10n, 16);
      expect(buffer).toEqual(Buffer.from([
        0x10, 0x0F, 0x0E, 0x0D, 0x0C, 0x0B, 0x0A, 0x09,
        0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01,
      ]));
    });

    it('should handle negative values for non-8-byte buffers', () => {
      const buffer = toSignedLittleBuffer(-1n, 4);
      expect(buffer).toEqual(Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]));
    });
  });
});

describe('readBufferFromBigInt', () => {
  describe('8-byte buffers (native methods)', () => {
    it('should write unsigned little endian', () => {
      const buffer = readBufferFromBigInt(0x0102030405060708n, 8, true, false);
      expect(buffer).toEqual(Buffer.from([0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01]));
    });

    it('should write unsigned big endian', () => {
      const buffer = readBufferFromBigInt(0x0102030405060708n, 8, false, false);
      expect(buffer).toEqual(Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]));
    });

    it('should write signed positive little endian', () => {
      const buffer = readBufferFromBigInt(1234567890n, 8, true, true);
      const read = readBigIntFromBuffer(buffer, true, true);
      expect(read).toBe(1234567890n);
    });

    it('should write signed negative little endian', () => {
      const buffer = readBufferFromBigInt(-1n, 8, true, true);
      expect(buffer).toEqual(Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]));
    });

    it('should write signed negative big endian', () => {
      const buffer = readBufferFromBigInt(-1n, 8, false, true);
      expect(buffer).toEqual(Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]));
    });
  });

  describe('non-8-byte buffers', () => {
    it('should write 4-byte unsigned little endian', () => {
      const buffer = readBufferFromBigInt(0x12345678n, 4, true, false);
      expect(buffer).toEqual(Buffer.from([0x78, 0x56, 0x34, 0x12]));
    });

    it('should write 4-byte unsigned big endian', () => {
      const buffer = readBufferFromBigInt(0x12345678n, 4, false, false);
      expect(buffer).toEqual(Buffer.from([0x12, 0x34, 0x56, 0x78]));
    });

    it('should write 2-byte value', () => {
      const buffer = readBufferFromBigInt(0x1234n, 2, true, false);
      expect(buffer).toEqual(Buffer.from([0x34, 0x12]));
    });

    it('should write 16-byte value', () => {
      const buffer = readBufferFromBigInt(0x0102030405060708090A0B0C0D0E0F10n, 16, false, false);
      expect(buffer).toEqual(Buffer.from([
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10,
      ]));
    });

    it('should write signed negative 4-byte value', () => {
      const buffer = readBufferFromBigInt(-1n, 4, true, true);
      expect(buffer).toEqual(Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]));
    });

    it('should write signed negative 4-byte value big endian', () => {
      const buffer = readBufferFromBigInt(-1n, 4, false, true);
      expect(buffer).toEqual(Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]));
    });

    it('should pad with zeros for smaller values', () => {
      const buffer = readBufferFromBigInt(0xFFn, 4, true, false);
      expect(buffer).toEqual(Buffer.from([0xFF, 0x00, 0x00, 0x00]));
    });
  });

  describe('error handling', () => {
    it('should throw when converting negative to unsigned', () => {
      expect(() => readBufferFromBigInt(-1n, 8, true, false))
        .toThrow('Cannot convert negative to unsigned');
    });

    it('should throw when value is too large for buffer', () => {
      const largeValue = 0x1FFFFFFFFFFFFFFFFn; // Too large for 8 bytes
      expect(() => readBufferFromBigInt(largeValue, 8, true, false))
        .toThrow('Value 36893488147419103231 does not fit in 8 unsigned bytes');
    });
  });

  describe('round-trip consistency', () => {
    it('should maintain value through read/write cycle (unsigned)', () => {
      const original = 0x123456789ABCDEFn;
      const buffer = readBufferFromBigInt(original, 8, true, false);
      const result = readBigIntFromBuffer(buffer, true, false);
      expect(result).toBe(original);
    });

    it('should maintain value through read/write cycle (signed positive)', () => {
      const original = 0x123456789ABCDEFn;
      const buffer = readBufferFromBigInt(original, 8, true, true);
      const result = readBigIntFromBuffer(buffer, true, true);
      expect(result).toBe(original);
    });

    it('should maintain value through read/write cycle (signed negative)', () => {
      const original = -0x123456789ABCDEFn;
      const buffer = readBufferFromBigInt(original, 8, true, true);
      const result = readBigIntFromBuffer(buffer, true, true);
      expect(result).toBe(original);
    });

    it('should maintain value through read/write cycle (big endian)', () => {
      const original = 0x123456789ABCDEFn;
      const buffer = readBufferFromBigInt(original, 8, false, false);
      const result = readBigIntFromBuffer(buffer, false, false);
      expect(result).toBe(original);
    });

    it('should maintain value for 4-byte buffers', () => {
      const original = 0x12345678n;
      const buffer = readBufferFromBigInt(original, 4, true, false);
      const result = readBigIntFromBuffer(buffer, true, false);
      expect(result).toBe(original);
    });
  });
});
