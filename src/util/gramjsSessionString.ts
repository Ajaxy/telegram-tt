import type { ApiSessionData } from '../api/types';

import { DC_IDS } from '../config';
import { bufferFromBase64, bufferToHex } from './encoding/buffer';

// https://github.com/gram-js/gramjs/blob/master/gramjs/sessions/StringSession.ts
const SESSION_STRING_VERSION = '1';
const AUTH_KEY_LENGTH = 256;
// Length of the base64 part of a Telethon session string:
// `dcId` (1 byte) + IPv4 address (4 bytes) + `port` (2 bytes) + auth key (256 bytes)
const TELETHON_BASE64_LENGTH = 352;
const MAX_ADDRESS_LENGTH = 100;
const IPV6_LENGTH = 16;
const MIN_PORT = 1;
const MAX_PORT = 65535;

/**
 * Parses a GramJS (or Telethon) session string into `ApiSessionData`, which allows
 * signing in without requesting a login code.
 *
 * The server address from the string is intentionally ignored, since the app
 * always connects to its own list of data centers.
 */
export function parseGramJsSessionString(sessionString: string): ApiSessionData | undefined {
  // Session strings are often copied with line breaks or trailing whitespace
  const cleanedString = sessionString.replace(/\s+/g, '');
  if (!cleanedString || cleanedString[0] !== SESSION_STRING_VERSION) {
    return undefined;
  }

  let buffer: Uint8Array;
  try {
    buffer = bufferFromBase64(cleanedString.slice(1));
  } catch (err) {
    return undefined;
  }

  if (buffer.length < 3) {
    return undefined;
  }

  let offset = 0;

  const dcId = buffer[offset];
  offset += 1;
  if (!DC_IDS.some((id) => id === dcId)) {
    return undefined;
  }

  if (cleanedString.length - 1 === TELETHON_BASE64_LENGTH) {
    // Telethon session strings contain a raw IPv4 address instead of a length-prefixed one
    offset += 4;
  } else {
    const addressLength = (buffer[offset] << 8) | buffer[offset + 1];
    if (addressLength > MAX_ADDRESS_LENGTH) {
      // IPv6 addresses are stored as 16 raw bytes instead of a length-prefixed string
      offset += IPV6_LENGTH;
    } else {
      offset += 2 + addressLength;
    }
  }

  if (offset + 2 > buffer.length) {
    return undefined;
  }

  const port = (buffer[offset] << 8) | buffer[offset + 1];
  offset += 2;
  if (port < MIN_PORT || port > MAX_PORT) {
    return undefined;
  }

  const authKey = buffer.slice(offset);
  if (authKey.length !== AUTH_KEY_LENGTH) {
    return undefined;
  }

  return {
    mainDcId: dcId,
    keys: {
      [dcId]: bufferToHex(authKey),
    },
  };
}
