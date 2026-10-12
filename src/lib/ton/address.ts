import { base64UrlToBuffer, bufferToBase64Url } from '../../util/encoding/base64';
import { bufferFromHex, bufferToHex } from '../../util/encoding/buffer';

export type TonAddress = {
  workchain: number;
  hash: Uint8Array;
  isBounceable: boolean;
  isTestOnly: boolean;
};

const FRIENDLY_ADDRESS_LENGTH = 48;
const FRIENDLY_ADDRESS_BYTES = 36;
const RAW_ADDRESS_REGEX = /^(-?\d+):([0-9a-f]{64})$/i;
const TAG_BOUNCEABLE = 0x11;
const TAG_NON_BOUNCEABLE = 0x51;
const TAG_TEST_ONLY_FLAG = 0x80;
const MIN_WORKCHAIN = -128;
const MAX_WORKCHAIN = 127;

export function parseAddress(value: string): TonAddress | undefined {
  const trimmed = value.trim();

  const rawMatch = trimmed.match(RAW_ADDRESS_REGEX);

  if (rawMatch) {
    const workchain = Number(rawMatch[1]);

    if (workchain < MIN_WORKCHAIN || workchain > MAX_WORKCHAIN) {
      return undefined;
    }

    return {
      workchain,
      hash: bufferFromHex(rawMatch[2]),
      isBounceable: true,
      isTestOnly: false,
    };
  }

  if (trimmed.length !== FRIENDLY_ADDRESS_LENGTH) {
    return undefined;
  }

  let bytes: Uint8Array;

  try {
    bytes = base64UrlToBuffer(trimmed);
  } catch {
    return undefined;
  }

  if (bytes.length !== FRIENDLY_ADDRESS_BYTES) {
    return undefined;
  }

  const checksum = (bytes[34] << 8) | bytes[35];

  if (checksum !== crc16(bytes.subarray(0, 34))) {
    return undefined;
  }

  const isTestOnly = Boolean(bytes[0] & TAG_TEST_ONLY_FLAG);
  const tag = bytes[0] & ~TAG_TEST_ONLY_FLAG;

  if (tag !== TAG_BOUNCEABLE && tag !== TAG_NON_BOUNCEABLE) {
    return undefined;
  }

  // Workchain byte is signed: `0xff` means the masterchain (-1)
  const workchain = bytes[1] === 0xff ? -1 : bytes[1];

  return {
    workchain,
    hash: bytes.slice(2, 34),
    isBounceable: tag === TAG_BOUNCEABLE,
    isTestOnly,
  };
}

export function formatAddress(
  workchain: number, hash: Uint8Array, isBounceable?: boolean, isTestOnly?: boolean,
): string {
  const bytes = new Uint8Array(FRIENDLY_ADDRESS_BYTES);
  bytes[0] = (isBounceable ? TAG_BOUNCEABLE : TAG_NON_BOUNCEABLE) | (isTestOnly ? TAG_TEST_ONLY_FLAG : 0);
  bytes[1] = workchain === -1 ? 0xff : workchain;
  bytes.set(hash, 2);

  const checksum = crc16(bytes.subarray(0, 34));
  bytes[34] = checksum >> 8;
  bytes[35] = checksum & 0xff;

  return bufferToBase64Url(bytes);
}

// `wc:hex`, the form Toncenter reports accounts in
export function toRawAddress(address: string): string | undefined {
  const parsed = parseAddress(address);
  if (!parsed) return undefined;

  return `${parsed.workchain}:${bufferToHex(parsed.hash)}`;
}

// A transfer to the bounceable form of a wallet not deployed yet comes back, so `UQ` is what the owner shares
export function toNonBounceableAddress(address: string): string {
  const parsed = parseAddress(address);
  if (!parsed) return address;

  return formatAddress(parsed.workchain, parsed.hash, false, parsed.isTestOnly);
}

// CRC-16/XMODEM, as used by TON user-friendly addresses
function crc16(data: Uint8Array): number {
  let crc = 0;

  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8;

    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }

    crc &= 0xffff;
  }

  return crc;
}
