// TonConnect `signData`: text and bytes sign a message binding the address, domain and time; a cell is
// wrapped into a message cell carrying the same, so a contract can check the signature on the chain

import type { TonAddress } from './address';
import type { Cell } from './cell';
import type { TonConnectSignData } from './tonConnect';

import { bufferFromBase64, bufferFromUtf8, concat } from '../../util/encoding/buffer';
import { parseBoc } from './boc';
import { Builder } from './cell';
import { signEd25519 } from './ed25519';

import { crc32 } from '../gramjs/Helpers';

const MESSAGE_PREFIX_MARKER = new Uint8Array([0xff, 0xff]);
const MESSAGE_PREFIX = 'ton-connect/sign-data/';
const TEXT_PREFIX = 'txt';
const BINARY_PREFIX = 'bin';
const CELL_MESSAGE_OPCODE = 0x75569022;
// A cell holds 1023 bits, so a snake chunk is 127 whole bytes
const SNAKE_CHUNK_BYTES = 127;
const INT32_BYTES = 4;
const INT64_BYTES = 8;

export async function signTonConnectData({
  data, address, domain, timestamp, seed,
}: {
  data: TonConnectSignData;
  address: TonAddress;
  domain: string;
  // Unix seconds
  timestamp: number;
  seed: Uint8Array;
}): Promise<Uint8Array<ArrayBuffer>> {
  const hash = data.type === 'cell'
    ? (await buildCellMessage(data, address, domain, timestamp)).hash
    : new Uint8Array(await crypto.subtle.digest('SHA-256', buildMessage(data, address, domain, timestamp)));

  return signEd25519(hash, seed);
}

// Every number is big-endian
function buildMessage(
  data: Exclude<TonConnectSignData, { type: 'cell' }>, address: TonAddress, domain: string, timestamp: number,
) {
  const domainBytes = bufferFromUtf8(domain);
  const payload = data.type === 'text' ? bufferFromUtf8(data.text) : bufferFromBase64(data.bytes);

  return concat(
    MESSAGE_PREFIX_MARKER,
    bufferFromUtf8(MESSAGE_PREFIX),
    encodeInteger(address.workchain, INT32_BYTES),
    address.hash,
    encodeInteger(domainBytes.length, INT32_BYTES),
    domainBytes,
    encodeInteger(timestamp, INT64_BYTES),
    bufferFromUtf8(data.type === 'text' ? TEXT_PREFIX : BINARY_PREFIX),
    encodeInteger(payload.length, INT32_BYTES),
    payload,
  );
}

// `message#75569022 schema_hash:uint32 timestamp:uint64 userAddress:MsgAddress {n:#}
// appDomain:^(SnakeData ~n) payload:^Cell = Message`
async function buildCellMessage(
  data: Extract<TonConnectSignData, { type: 'cell' }>, address: TonAddress, domain: string, timestamp: number,
) {
  return new Builder()
    .storeUint(CELL_MESSAGE_OPCODE, 32)
    .storeUint(crc32(data.schema), 32)
    .storeUint(timestamp, 64)
    .storeAddress(address.workchain, address.hash)
    .storeRef(await buildSnakeCell(encodeDnsDomain(domain)))
    .storeRef(await parseBoc(data.cell))
    .build();
}

// TEP-81: the labels from the top level down, each closed by a zero byte, as `com\0stonfi\0`
function encodeDnsDomain(domain: string) {
  return bufferFromUtf8(domain.split('.').reverse().map((label) => `${label}\0`).join(''));
}

async function buildSnakeCell(bytes: Uint8Array): Promise<Cell> {
  let cell: Cell | undefined;

  for (let offset = Math.floor((bytes.length - 1) / SNAKE_CHUNK_BYTES) * SNAKE_CHUNK_BYTES; offset >= 0;
    offset -= SNAKE_CHUNK_BYTES) {
    const builder = new Builder().storeBytes(bytes.subarray(offset, offset + SNAKE_CHUNK_BYTES));
    if (cell) builder.storeRef(cell);

    cell = await builder.build();
  }

  return cell!;
}

function encodeInteger(value: number, byteLength: number) {
  const view = new DataView(new ArrayBuffer(byteLength));

  if (byteLength === INT64_BYTES) {
    view.setBigUint64(0, BigInt(value));
  } else {
    view.setInt32(0, value);
  }

  return new Uint8Array(view.buffer);
}
