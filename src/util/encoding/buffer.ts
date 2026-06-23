export function concat(...buffers: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const totalLength = buffers.reduce((acc, buffer) => acc + buffer.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }
  return result;
}

export function copy(buffer: Uint8Array): Uint8Array {
  return new Uint8Array(buffer);
}

export function buffersEqual(buffer1: Uint8Array, buffer2: Uint8Array): boolean {
  if (buffer1.length !== buffer2.length) {
    return false;
  }
  for (let i = 0; i < buffer1.length; i++) {
    if (buffer1[i] !== buffer2[i]) {
      return false;
    }
  }
  return true;
}

export function readInt32LE(buffer: Uint8Array, offset = 0) {
  checkBounds(buffer, offset, 4);

  return buffer[offset]
    | (buffer[offset + 1] << 8)
    | (buffer[offset + 2] << 16)
    | (buffer[offset + 3] << 24);
}

export function readUint32LE(buffer: Uint8Array, offset = 0) {
  checkBounds(buffer, offset, 4);

  return (buffer[offset]
    | (buffer[offset + 1] << 8)
    | (buffer[offset + 2] << 16))
  + buffer[offset + 3] * 0x1000000;
}

export function readUint32BE(buffer: Uint8Array, offset = 0) {
  checkBounds(buffer, offset, 4);

  return buffer[offset] * 0x1000000
    + ((buffer[offset + 1] << 16)
      | (buffer[offset + 2] << 8)
      | buffer[offset + 3]);
}

export function writeInt32LE(buffer: Uint8Array, value: number, offset = 0) {
  checkBounds(buffer, offset, 4);

  buffer[offset] = value & 0xFF;
  buffer[offset + 1] = value >>> 8;
  buffer[offset + 2] = value >>> 16;
  buffer[offset + 3] = value >>> 24;
}

export function writeUint32LE(buffer: Uint8Array, value: number, offset = 0) {
  checkBounds(buffer, offset, 4);

  buffer[offset] = value & 0xFF;
  buffer[offset + 1] = value >>> 8;
  buffer[offset + 2] = value >>> 16;
  buffer[offset + 3] = value >>> 24;
}

export function writeUint32BE(buffer: Uint8Array, value: number, offset = 0) {
  checkBounds(buffer, offset, 4);

  buffer[offset] = value >>> 24;
  buffer[offset + 1] = value >>> 16;
  buffer[offset + 2] = value >>> 8;
  buffer[offset + 3] = value & 0xFF;
}

export function readBigUint64LE(buffer: Uint8Array, offset = 0) {
  checkBounds(buffer, offset, 8);

  const low = buffer[offset]
    + buffer[offset + 1] * 0x100
    + buffer[offset + 2] * 0x10000
    + buffer[offset + 3] * 0x1000000;
  const high = buffer[offset + 4]
    + buffer[offset + 5] * 0x100
    + buffer[offset + 6] * 0x10000
    + buffer[offset + 7] * 0x1000000;

  return BigInt(low) + (BigInt(high) << 32n);
}

export function readBigUint64BE(buffer: Uint8Array, offset = 0) {
  checkBounds(buffer, offset, 8);

  const high = buffer[offset] * 0x1000000
    + buffer[offset + 1] * 0x10000
    + buffer[offset + 2] * 0x100
    + buffer[offset + 3];
  const low = buffer[offset + 4] * 0x1000000
    + buffer[offset + 5] * 0x10000
    + buffer[offset + 6] * 0x100
    + buffer[offset + 7];

  return BigInt(low) + (BigInt(high) << 32n);
}

export function writeBigInt64LE(buffer: Uint8Array, value: bigint, offset = 0) {
  checkBounds(buffer, offset, 8);

  const unsignedValue = BigInt.asUintN(64, value);
  const low = Number(unsignedValue & 0xFFFFFFFFn);
  const high = Number((unsignedValue >> 32n) & 0xFFFFFFFFn);

  buffer[offset] = low & 0xFF;
  buffer[offset + 1] = low >>> 8;
  buffer[offset + 2] = low >>> 16;
  buffer[offset + 3] = low >>> 24;
  buffer[offset + 4] = high & 0xFF;
  buffer[offset + 5] = high >>> 8;
  buffer[offset + 6] = high >>> 16;
  buffer[offset + 7] = high >>> 24;
}

const HEX_VALUES = buildHexValues();
const BASE64_VALUES = buildBase64Values();

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function bufferFromHex(hex: string): Uint8Array<ArrayBuffer> {
  if (typeof Uint8Array.fromHex === 'function') {
    return Uint8Array.fromHex(hex);
  }

  if (hex.length % 2 !== 0) {
    throw new SyntaxError('Hex string length must be a multiple of 2');
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const high = HEX_VALUES[hex.charCodeAt(i * 2)] ?? -1;
    const low = HEX_VALUES[hex.charCodeAt(i * 2 + 1)] ?? -1;
    if (high === -1 || low === -1) {
      throw new SyntaxError('Invalid hex character');
    }

    bytes[i] = (high << 4) | low;
  }

  return bytes;
}

export function bufferToHex(buffer: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < buffer.length; i++) {
    hex += buffer[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function bufferFromBase64(base64: string): Uint8Array<ArrayBuffer> {
  if (typeof Uint8Array.fromBase64 === 'function') {
    return Uint8Array.fromBase64(base64);
  }

  // TODO: Drop in 2028 when method is Baseline Widely Available
  const paddingLength = base64.length - base64.replace(/=+$/, '').length;
  if (paddingLength > 2) {
    throw new SyntaxError('Invalid base64 padding');
  }

  const normalizedBase64 = base64.slice(0, base64.length - paddingLength);
  const expectedPadding = (4 - (normalizedBase64.length % 4)) % 4;
  if (paddingLength && paddingLength !== expectedPadding) {
    throw new SyntaxError('Invalid base64 padding');
  }
  if (normalizedBase64.length % 4 === 1) {
    throw new SyntaxError('Invalid base64 length');
  }

  const bytes = new Uint8Array(Math.floor((normalizedBase64.length * 3) / 4));
  let byteIndex = 0;
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < normalizedBase64.length; i++) {
    const char = normalizedBase64[i];
    const value = BASE64_VALUES[normalizedBase64.charCodeAt(i)] ?? -1;
    if (value === -1) {
      throw new SyntaxError(`Invalid base64 character: ${char}`);
    }

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes[byteIndex++] = (buffer >> bits) & 0xFF;
    }
  }

  if (bits && (buffer & ((1 << bits) - 1)) !== 0) {
    throw new SyntaxError('Invalid base64 overflow bits');
  }
  if (byteIndex !== bytes.length) {
    throw new SyntaxError('Invalid base64 partial byte');
  }

  return bytes;
}

export function bufferFromUtf8(value: string): Uint8Array<ArrayBuffer> {
  return textEncoder.encode(value);
}

export function bufferToUtf8(bytes: Uint8Array): string {
  return textDecoder.decode(bytes);
}

function checkBounds(buffer: Uint8Array, offset: number, byteLength: number) {
  if (!Number.isInteger(offset) || offset < 0 || offset + byteLength > buffer.length) {
    throw new RangeError('Offset is outside the bounds of the buffer');
  }
}

function buildHexValues() {
  const values = new Int8Array(128).fill(-1);

  // Add `0-9`
  for (let charCode = 48; charCode <= 57; charCode++) {
    values[charCode] = charCode - 48;
  }
  // Add `A-F` and `a-f`
  for (let i = 0; i < 6; i++) {
    values[65 + i] = i + 10;
    values[97 + i] = i + 10;
  }
  return values;
}

function buildBase64Values() {
  const values = new Int8Array(128).fill(-1);

  // Add `A-Z`
  for (let charCode = 65; charCode <= 90; charCode++) {
    values[charCode] = charCode - 65;
  }
  // Add `a-z`
  for (let charCode = 97; charCode <= 122; charCode++) {
    values[charCode] = charCode - 97 + 26;
  }
  // Add `0-9`
  for (let charCode = 48; charCode <= 57; charCode++) {
    values[charCode] = charCode - 48 + 52;
  }
  // Add `+` and `/`
  values[43] = 62;
  values[47] = 63;

  return values;
}
