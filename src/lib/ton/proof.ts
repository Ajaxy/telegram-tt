// TonConnect `ton-proof-item-v2`, as the server checks it on an imported wallet

import type { TonAddress } from './address';

import { concat } from '../../util/encoding/buffer';
import { signEd25519 } from './ed25519';

const MESSAGE_PREFIX = 'ton-proof-item-v2/';
const SIGNATURE_PREFIX = 'ton-connect';
const SIGNATURE_PREFIX_MARKER = new Uint8Array([0xff, 0xff]);
const INT32_BYTES = 4;
const INT64_BYTES = 8;
const textEncoder = new TextEncoder();

export async function signOwnershipProof({
  address, domain, timestamp, payload, seed,
}: {
  address: TonAddress;
  domain: string;
  // Unix seconds
  timestamp: number;
  payload: string;
  seed: Uint8Array;
}): Promise<Uint8Array<ArrayBuffer>> {
  const domainBytes = textEncoder.encode(domain);

  // The workchain is big-endian, while the domain length and the timestamp are little-endian
  const message = concat(
    textEncoder.encode(MESSAGE_PREFIX),
    encodeInteger(address.workchain, INT32_BYTES, false),
    address.hash,
    encodeInteger(domainBytes.length, INT32_BYTES, true),
    domainBytes,
    encodeInteger(timestamp, INT64_BYTES, true),
    textEncoder.encode(payload),
  );
  const toSign = concat(
    SIGNATURE_PREFIX_MARKER,
    textEncoder.encode(SIGNATURE_PREFIX),
    await sha256(message),
  );

  return signEd25519(await sha256(toSign), seed);
}

async function sha256(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}

function encodeInteger(value: number, byteLength: number, isLittleEndian: boolean): Uint8Array<ArrayBuffer> {
  const view = new DataView(new ArrayBuffer(byteLength));

  if (byteLength === INT64_BYTES) {
    view.setBigUint64(0, BigInt(value), isLittleEndian);
  } else {
    view.setInt32(0, value, isLittleEndian);
  }

  return new Uint8Array(view.buffer);
}
