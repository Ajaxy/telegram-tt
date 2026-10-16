const MAX_BITS = 1023;
const MAX_REFS = 4;
// `storeCoins` keeps the byte length in 4 bits, so an amount takes at most 15 bytes and stays below this limit
export const MAX_COINS = 1n << 120n;

export class Cell {
  constructor(
    public readonly bits: number[],
    public readonly refs: Cell[],
    public readonly hash: Uint8Array<ArrayBuffer>,
    public readonly depth: number,
  ) {}
}

export class Builder {
  private bits: number[] = [];

  private refs: Cell[] = [];

  get availableBits() {
    return MAX_BITS - this.bits.length;
  }

  get refCount() {
    return this.refs.length;
  }

  // The inline arm of `Either X ^X`
  storeCellInline(cell: Cell) {
    for (const bit of cell.bits) {
      this.storeBit(bit);
    }

    for (const ref of cell.refs) {
      this.storeRef(ref);
    }

    return this;
  }

  storeBit(bit: number) {
    if (this.bits.length >= MAX_BITS) {
      throw new Error('Cell bits overflow');
    }

    this.bits.push(bit ? 1 : 0);

    return this;
  }

  storeUint(value: bigint | number, bitCount: number) {
    const big = BigInt(value);

    if (big < 0n || big >> BigInt(bitCount) !== 0n) {
      throw new Error(`Value ${big} does not fit in ${bitCount} bits`);
    }

    for (let i = bitCount - 1; i >= 0; i--) {
      this.storeBit(Number((big >> BigInt(i)) & 1n));
    }

    return this;
  }

  storeBytes(bytes: Uint8Array) {
    for (const byte of bytes) {
      this.storeUint(byte, 8);
    }

    return this;
  }

  // VarUInteger 16, as used for nanoton amounts
  storeCoins(value: bigint) {
    if (value === 0n) {
      return this.storeUint(0, 4);
    }

    let byteLength = 0;

    for (let rest = value; rest > 0n; rest >>= 8n) {
      byteLength++;
    }

    return this.storeUint(byteLength, 4).storeUint(value, byteLength * 8);
  }

  // `addr_std$10` without anycast
  storeAddress(workchain: number, hash: Uint8Array) {
    this.storeUint(2, 2).storeBit(0);
    this.storeUint(workchain & 0xff, 8);

    return this.storeBytes(hash);
  }

  storeRef(cell: Cell) {
    if (this.refs.length >= MAX_REFS) {
      throw new Error('Cell refs overflow');
    }

    this.refs.push(cell);

    return this;
  }

  async build(): Promise<Cell> {
    const depth = this.refs.length ? Math.max(...this.refs.map((ref) => ref.depth)) + 1 : 0;
    const hash = await computeHash(this.bits, this.refs);

    return new Cell([...this.bits], [...this.refs], hash, depth);
  }
}

// Bits padded to a byte boundary with a completion tag: `1` followed by zeros
export function buildAugmentedData(bits: number[]): Uint8Array {
  const padded = [...bits];

  if (padded.length % 8 !== 0) {
    padded.push(1);

    while (padded.length % 8 !== 0) {
      padded.push(0);
    }
  }

  const bytes = new Uint8Array(padded.length / 8);

  for (let i = 0; i < padded.length; i++) {
    bytes[i >> 3] |= padded[i] << (7 - (i & 7));
  }

  return bytes;
}

export function buildDescriptors(bits: number[], refCount: number): [number, number] {
  return [refCount, Math.floor(bits.length / 8) + Math.ceil(bits.length / 8)];
}

async function computeHash(bits: number[], refs: Cell[]): Promise<Uint8Array<ArrayBuffer>> {
  const data = buildAugmentedData(bits);
  const [d1, d2] = buildDescriptors(bits, refs.length);

  const buffer = new Uint8Array(2 + data.length + refs.length * 34);
  buffer[0] = d1;
  buffer[1] = d2;
  buffer.set(data, 2);

  let offset = 2 + data.length;

  for (const ref of refs) {
    buffer[offset] = ref.depth >> 8;
    buffer[offset + 1] = ref.depth & 0xff;
    offset += 2;
  }

  for (const ref of refs) {
    buffer.set(ref.hash, offset);
    offset += 32;
  }

  return new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
}
