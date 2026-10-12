import type { Cell } from './cell';

import { bufferFromBase64, bufferToHex } from '../../util/encoding/buffer';
import { buildAugmentedData, buildDescriptors, Builder } from './cell';

const BOC_MAGIC = [0xb5, 0xee, 0x9c, 0x72];
const HAS_CRC32C_FLAG = 0x40;
// `max_ext_msg_size`, `max_ext_msg_depth` and `max_msg_cells` of config parameter 43: a larger BOC could never be sent
export const MAX_BOC_BYTES = 65535;
const MAX_CELL_DEPTH = 512;
const MAX_CELL_COUNT = 8192;

export function serializeBoc(root: Cell): Uint8Array<ArrayBuffer> {
  const cells = sortCells(root);

  // The header says how many bytes each reference index takes, so every cell must use the same width
  const sizeBytes = countMinBytes(cells.length);
  const serializedCells = cells.map(({ cell, refIndexes }) => serializeCell(cell, refIndexes, sizeBytes));
  const totalCellsSize = serializedCells.reduce((sum, bytes) => sum + bytes.length, 0);

  const offsetBytes = countMinBytes(totalCellsSize);

  const header = [
    ...BOC_MAGIC,
    HAS_CRC32C_FLAG | sizeBytes,
    offsetBytes,
    ...toBytesBe(cells.length, sizeBytes),
    ...toBytesBe(1, sizeBytes), // Roots count
    ...toBytesBe(0, sizeBytes), // Absent count
    ...toBytesBe(totalCellsSize, offsetBytes),
    ...toBytesBe(0, sizeBytes), // Root index
  ];

  const body = new Uint8Array(header.length + totalCellsSize + 4);
  body.set(header);

  let offset = header.length;

  for (const bytes of serializedCells) {
    body.set(bytes, offset);
    offset += bytes.length;
  }

  const checksum = crc32c(body.subarray(0, offset));
  body[offset] = checksum & 0xff;
  body[offset + 1] = (checksum >> 8) & 0xff;
  body[offset + 2] = (checksum >> 16) & 0xff;
  body[offset + 3] = (checksum >>> 24) & 0xff;

  return body;
}

// What is left of the limits above for the BOCs that share one external message
export type BocBudget = {
  bytes: number;
  cells: number;
};

export function createBocBudget(): BocBudget {
  return { bytes: MAX_BOC_BYTES, cells: MAX_CELL_COUNT };
}

export async function parseBoc(base64: string, budget?: BocBudget): Promise<Cell> {
  if (base64.length > Math.ceil(MAX_BOC_BYTES / 3) * 4) {
    throw new Error('BOC is too large');
  }

  const bytes = bufferFromBase64(base64);

  if (budget) {
    budget.bytes -= bytes.length;

    if (budget.bytes < 0) throw new Error('BOCs are too large together');
  }

  if (bytes.length < 6 || !BOC_MAGIC.every((byte, index) => bytes[index] === byte)
    || bytes[4] & 0x38) {
    throw new Error('Invalid BOC header');
  }

  const sizeBytes = bytes[4] & 0x07;
  const offsetBytes = bytes[5];

  if (!sizeBytes || sizeBytes > 4 || !offsetBytes || offsetBytes > 4) {
    throw new Error('Invalid BOC integer size');
  }

  let offset = 6;
  const cellCount = readBe(bytes, offset, sizeBytes);
  offset += sizeBytes;

  const rootCount = readBe(bytes, offset, sizeBytes);
  offset += sizeBytes;

  const absentCount = readBe(bytes, offset, sizeBytes);
  offset += sizeBytes;

  const cellsSize = readBe(bytes, offset, offsetBytes);
  offset += offsetBytes;

  const rootIndex = readBe(bytes, offset, sizeBytes);
  offset += sizeBytes;

  if (!cellCount || cellCount > bytes.length / 2 || rootCount !== 1 || absentCount || rootIndex >= cellCount) {
    throw new Error('Invalid BOC roots');
  }

  if (cellCount > MAX_CELL_COUNT) {
    throw new Error('BOC has too many cells');
  }

  if (budget) {
    budget.cells -= cellCount;

    if (budget.cells < 0) throw new Error('BOCs have too many cells together');
  }

  const indexOffset = offset;

  if (bytes[4] & 0x80) {
    offset += cellCount * offsetBytes; // Index
  }

  const cellsOffset = offset;
  const cellsEnd = offset + cellsSize;
  const hasChecksum = Boolean(bytes[4] & HAS_CRC32C_FLAG);

  if (cellsEnd + (hasChecksum ? 4 : 0) !== bytes.length) {
    throw new Error('Invalid BOC size');
  }

  if (hasChecksum && new DataView(bytes.buffer, bytes.byteOffset).getUint32(cellsEnd, true)
    !== crc32c(bytes.subarray(0, cellsEnd))) {
    throw new Error('Invalid BOC checksum');
  }

  const rawCells: { bits: number[]; refIndexes: number[] }[] = [];

  for (let i = 0; i < cellCount; i++) {
    if (offset + 2 > cellsEnd) throw new Error('Truncated BOC cell');

    const d1 = bytes[offset];
    const d2 = bytes[offset + 1];
    offset += 2;

    if (d1 > 4) {
      throw new Error('Only ordinary level-zero cells are supported');
    }

    const refCount = d1 & 0x07;
    const dataBytes = Math.ceil(d2 / 2);
    if (offset + dataBytes + refCount * sizeBytes > cellsEnd) throw new Error('Truncated BOC cell');

    const bits: number[] = [];
    let bitCount = Math.floor(d2 / 2) * 8;

    if (d2 % 2) {
      // Augmented: the completion tag is the lowest set bit of the last byte
      const lastByte = bytes[offset + dataBytes - 1];
      if (!(lastByte & 0x7f)) throw new Error('Invalid BOC completion tag');

      let padding = 1;

      while (!((lastByte >> (padding - 1)) & 1)) {
        padding++;
      }

      bitCount += 8 - padding;
    }

    for (let bit = 0; bit < bitCount; bit++) {
      bits.push((bytes[offset + (bit >> 3)] >> (7 - (bit & 7))) & 1);
    }

    offset += dataBytes;

    const refIndexes: number[] = [];

    for (let ref = 0; ref < refCount; ref++) {
      const refIndex = readBe(bytes, offset, sizeBytes);
      if (refIndex <= i || refIndex >= cellCount) throw new Error('Invalid BOC reference');

      refIndexes.push(refIndex);
      offset += sizeBytes;
    }

    rawCells.push({ bits, refIndexes });

    if (bytes[4] & 0x80 && readBe(bytes, indexOffset + i * offsetBytes, offsetBytes) !== offset - cellsOffset) {
      throw new Error('Invalid BOC index');
    }
  }

  if (offset !== cellsEnd) throw new Error('Unexpected BOC cell data');

  const reachable = new Set([rootIndex]);

  for (const index of reachable) {
    rawCells[index].refIndexes.forEach((refIndex) => reachable.add(refIndex));
  }

  if (reachable.size !== cellCount) throw new Error('Unreachable BOC cell');

  // Children always have higher indexes, so build back-to-front
  const cells: Cell[] = [];

  for (let i = cellCount - 1; i >= 0; i--) {
    const builder = new Builder();

    for (const bit of rawCells[i].bits) {
      builder.storeBit(bit);
    }

    for (const refIndex of rawCells[i].refIndexes) {
      builder.storeRef(cells[refIndex]);
    }

    cells[i] = await builder.build();

    if (cells[i].depth > MAX_CELL_DEPTH) throw new Error('BOC is too deep');
  }

  return cells[rootIndex];
}

function readBe(bytes: Uint8Array, offset: number, byteLength: number): number {
  if (offset + byteLength > bytes.length) throw new Error('Truncated BOC integer');

  let value = 0;

  for (let i = 0; i < byteLength; i++) {
    value = value * 256 + bytes[offset + i];
  }

  return value;
}

// Deduplicates shared cells and orders them root-first, matching the reference implementation byte-for-byte
function sortCells(root: Cell): { cell: Cell; refIndexes: number[] }[] {
  const byHash = new Map<string, Cell>();
  let pending: Cell[] = [root];

  while (pending.length) {
    const layer = pending;
    pending = [];

    for (const cell of layer) {
      const key = hashKey(cell);
      if (byHash.has(key)) continue;

      byHash.set(key, cell);
      pending.push(...cell.refs);
    }
  }

  const remaining = new Set(byHash.keys());
  const sorted: string[] = [];

  function visit(key: string) {
    if (!remaining.has(key)) return;

    remaining.delete(key);

    const { refs } = byHash.get(key)!;

    for (let i = refs.length - 1; i >= 0; i--) {
      visit(hashKey(refs[i]));
    }

    sorted.push(key);
  }

  while (remaining.size) {
    visit(remaining.values().next().value!);
  }

  sorted.reverse();

  const indexByHash = new Map(sorted.map((key, index) => [key, index]));

  return sorted.map((key) => {
    const cell = byHash.get(key)!;

    return {
      cell,
      refIndexes: cell.refs.map((ref) => indexByHash.get(hashKey(ref))!),
    };
  });
}

function hashKey(cell: Cell): string {
  return bufferToHex(cell.hash);
}

function serializeCell(cell: Cell, refIndexes: number[], sizeBytes: number): Uint8Array {
  const data = buildAugmentedData(cell.bits);
  const [d1, d2] = buildDescriptors(cell.bits, cell.refs.length);

  const bytes = new Uint8Array(2 + data.length + refIndexes.length * sizeBytes);
  bytes[0] = d1;
  bytes[1] = d2;
  bytes.set(data, 2);

  refIndexes.forEach((refIndex, position) => {
    bytes.set(toBytesBe(refIndex, sizeBytes), 2 + data.length + position * sizeBytes);
  });

  return bytes;
}

function countMinBytes(value: number): number {
  let bytes = 1;

  for (let rest = value; rest >= 256; rest = Math.floor(rest / 256)) {
    bytes++;
  }

  return bytes;
}

function toBytesBe(value: number, byteLength: number): number[] {
  const bytes: number[] = [];
  let rest = value;

  for (let i = 0; i < byteLength; i++) {
    bytes.unshift(rest & 0xff);
    rest = Math.floor(rest / 256);
  }

  return bytes;
}

let crc32cTable: Uint32Array | undefined;

// CRC-32C (Castagnoli); the plain CRC-32 elsewhere in the codebase uses a different polynomial
function crc32c(data: Uint8Array): number {
  if (!crc32cTable) {
    crc32cTable = new Uint32Array(256);

    for (let i = 0; i < 256; i++) {
      let value = i;

      for (let bit = 0; bit < 8; bit++) {
        value = value & 1 ? (value >>> 1) ^ 0x82f63b78 : value >>> 1;
      }

      crc32cTable[i] = value >>> 0;
    }
  }

  let crc = 0xffffffff;

  for (const byte of data) {
    crc = (crc >>> 8) ^ crc32cTable[(crc ^ byte) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}
