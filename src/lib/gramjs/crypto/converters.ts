/**
 * Uint32Array -> ArrayBuffer (low-endian os)
 */
export function i2abLow(buf: Uint32Array): ArrayBuffer {
  const uint8 = new Uint8Array(buf.length * 4);
  let i = 0;

  for (let j = 0; j < buf.length; j++) {
    const int = buf[j];

    uint8[i++] = int >>> 24;
    uint8[i++] = (int >> 16) & 0xFF;
    uint8[i++] = (int >> 8) & 0xFF;
    uint8[i++] = int & 0xFF;
  }

  return uint8.buffer;
}

/**
 * Uint32Array -> ArrayBuffer (big-endian os)
 */
export function i2abBig(buf: Uint32Array<ArrayBuffer>): ArrayBuffer {
  return buf.buffer;
}

/**
 * ArrayBuffer -> Uint32Array (low-endian os)
 */
export function ab2iLow(ab: ArrayBuffer | Uint8Array): Uint32Array {
  const uint8 = new Uint8Array(ab);
  const buf = new Uint32Array(uint8.length / 4);

  for (let i = 0; i < uint8.length; i += 4) {
    buf[i / 4] = (
      uint8[i] << 24
      ^ uint8[i + 1] << 16
      ^ uint8[i + 2] << 8
      ^ uint8[i + 3]
    );
  }

  return buf;
}

/**
 * ArrayBuffer -> Uint32Array (big-endian os)
 */
export function ab2iBig(ab: ArrayBuffer | Uint8Array): Uint32Array {
  return new Uint32Array(ab);
}

export const isBigEndian = new Uint8Array(new Uint32Array([0x01020304]))[0] === 0x01;
export const i2ab = isBigEndian ? i2abBig : i2abLow;
export const ab2i = isBigEndian ? ab2iBig : ab2iLow;
