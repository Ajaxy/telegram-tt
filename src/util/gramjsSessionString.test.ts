import { describe, expect, test } from 'vitest';

import { bufferToHex } from './encoding/buffer';
import { parseGramJsSessionString } from './gramjsSessionString';

// Mirrors the format produced by GramJS `StringSession.save()`:
// '1' + base64(dcId (1 byte) + address length (2 bytes BE) + address + port (2 bytes BE) + auth key (256 bytes))
function buildGramJsSessionString(dcId: number, address: string, port: number, authKey: Uint8Array) {
  const addressBuffer = new TextEncoder().encode(address);
  const buffer = new Uint8Array(1 + 2 + addressBuffer.length + 2 + authKey.length);
  let offset = 0;

  buffer[offset] = dcId;
  offset += 1;

  buffer[offset] = addressBuffer.length >> 8;
  buffer[offset + 1] = addressBuffer.length & 0xFF;
  offset += 2;

  buffer.set(addressBuffer, offset);
  offset += addressBuffer.length;

  buffer[offset] = port >> 8;
  buffer[offset + 1] = port & 0xFF;
  offset += 2;

  buffer.set(authKey, offset);

  return `1${btoa(String.fromCharCode(...buffer))}`;
}

// Telethon session strings contain a raw IPv4 address instead of a length-prefixed one
function buildTelethonSessionString(
  dcId: number, ipv4: [number, number, number, number], port: number, authKey: Uint8Array,
) {
  const buffer = new Uint8Array(1 + 4 + 2 + authKey.length);
  let offset = 0;

  buffer[offset] = dcId;
  offset += 1;
  buffer.set(ipv4, offset);
  offset += 4;

  buffer[offset] = port >> 8;
  buffer[offset + 1] = port & 0xFF;
  offset += 2;

  buffer.set(authKey, offset);

  const base64 = btoa(String.fromCharCode(...buffer));
  expect(base64).toHaveLength(352);

  return `1${base64}`;
}

function buildAuthKey() {
  const authKey = new Uint8Array(256);
  for (let i = 0; i < authKey.length; i++) {
    authKey[i] = (i * 7 + 3) & 0xFF;
  }
  return authKey;
}

const AUTH_KEY = buildAuthKey();
const AUTH_KEY_HEX = bufferToHex(AUTH_KEY);

describe('GramJS session string parser', () => {
  test('parses a session string with an IPv4 address', () => {
    const sessionString = buildGramJsSessionString(2, '149.154.167.51', 443, AUTH_KEY);

    expect(parseGramJsSessionString(sessionString)).toEqual({
      mainDcId: 2,
      keys: {
        2: AUTH_KEY_HEX,
      },
    });
  });

  test('parses a session string with an IPv6 address', () => {
    // The first two bytes of a raw IPv6 address are read as a length prefix and are above 100
    const sessionString = buildGramJsSessionString(1, '\u0020\u0001\u0000\u0002extended-address', 443, AUTH_KEY);

    expect(parseGramJsSessionString(sessionString)).toEqual({
      mainDcId: 1,
      keys: {
        1: AUTH_KEY_HEX,
      },
    });
  });

  test('parses a Telethon session string', () => {
    const sessionString = buildTelethonSessionString(4, [149, 154, 167, 91], 443, AUTH_KEY);

    expect(parseGramJsSessionString(sessionString)).toEqual({
      mainDcId: 4,
      keys: {
        4: AUTH_KEY_HEX,
      },
    });
  });

  test('supports all production data centers', () => {
    [1, 2, 3, 4, 5].forEach((dcId) => {
      const sessionString = buildGramJsSessionString(dcId, '149.154.167.51', 80, AUTH_KEY);
      expect(parseGramJsSessionString(sessionString)?.mainDcId).toBe(dcId);
    });
  });

  test('ignores whitespace', () => {
    const sessionString = buildGramJsSessionString(2, '149.154.167.51', 443, AUTH_KEY);
    const spacedString = `\n ${sessionString.slice(0, 10)} \n\t${sessionString.slice(10)} `;

    expect(parseGramJsSessionString(spacedString)).toEqual({
      mainDcId: 2,
      keys: {
        2: AUTH_KEY_HEX,
      },
    });
  });

  test.each([
    ['empty string', ''],
    ['wrong version', `2${buildGramJsSessionString(2, '149.154.167.51', 443, AUTH_KEY).slice(1)}`],
    ['not base64', '1!@#$%^&*()'],
    ['unknown data center', buildGramJsSessionString(6, '149.154.167.51', 443, AUTH_KEY)],
    ['zero data center', buildGramJsSessionString(0, '149.154.167.51', 443, AUTH_KEY)],
    ['zero port', buildGramJsSessionString(2, '149.154.167.51', 0, AUTH_KEY)],
    ['missing auth key', `1${btoa(String.fromCharCode(
      2, 0, 14, ...new TextEncoder().encode('149.154.167.51'), 1, 187,
    ))}`],
    ['truncated auth key', `1${btoa(String.fromCharCode(
      2, 0, 14, ...new TextEncoder().encode('149.154.167.51'), 1, 187, ...AUTH_KEY.slice(0, 255),
    ))}`],
    ['truncated buffer', `1${btoa(String.fromCharCode(2, 0, 14))}`],
  ])('rejects invalid session strings (%s)', (_name, sessionString) => {
    expect(parseGramJsSessionString(sessionString)).toBeUndefined();
  });
});
