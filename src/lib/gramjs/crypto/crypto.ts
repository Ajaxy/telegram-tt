import AES from '@cryptography/aes';

class Counter {
  public counter: Buffer<ArrayBuffer>;

  constructor(initialValue: Buffer) {
    this.counter = Buffer.from(initialValue);
  }

  increment() {
    for (let i = 15; i >= 0; i--) {
      if (this.counter[i] === 255) {
        this.counter[i] = 0;
      } else {
        this.counter[i]++;
        break;
      }
    }
  }
}

class CTR {
  private _counter: Counter;

  private _carryBlock: Buffer | undefined;

  private _carryOffset: number;

  private _aes: AES;

  constructor(key: Buffer, counter: Counter | Buffer) {
    if (!(counter instanceof Counter)) {
      counter = new Counter(counter);
    }

    this._counter = counter;

    this._carryBlock = undefined;
    this._carryOffset = 0;

    this._aes = new AES(key);
  }

  update(plainText: Buffer<ArrayBuffer>) {
    return this.encrypt(plainText);
  }

  encrypt(plain: Buffer): Buffer {
    const aes = this._aes;
    const ctr = this._counter;

    const src = plain;
    const n = src.length;

    const dst = Buffer.allocUnsafe(n);

    let pos = 0;

    // 1) Consume any carried keystream from the previous call
    if (this._carryBlock) {
      const take = Math.min(16 - this._carryOffset, n);
      for (let j = 0; j < take; j++) {
        dst[pos + j] = src[pos + j] ^ this._carryBlock[this._carryOffset + j];
      }
      pos += take;
      this._carryOffset += take;

      if (this._carryOffset === 16) {
        this._carryBlock = undefined;
        this._carryOffset = 0;
      }
    }

    // Temporary keystream block for this call
    const keystream = Buffer.allocUnsafe(16);

    // 2) Full 16-byte blocks
    while (pos + 16 <= n) {
      const words = aes.encrypt(ctr.counter);
      writeU32WordsBE(words, keystream);
      ctr.increment();

      for (let j = 0; j < 16; j++) {
        dst[pos + j] = src[pos + j] ^ keystream[j];
      }
      pos += 16;
    }

    // 3) Tail (<16 bytes) — store carryover for next call
    if (pos < n) {
      const words = aes.encrypt(ctr.counter);
      writeU32WordsBE(words, keystream);
      ctr.increment();

      let used = 0;
      for (; pos < n; pos++, used++) {
        dst[pos] = src[pos] ^ keystream[used];
      }
      this._carryBlock = keystream;
      this._carryOffset = used;
    }

    return dst;
  }
}

export type CtrImpl = CTR;

// endregion
export function createDecipheriv(algorithm: string, key: Buffer, iv: Buffer) {
  if (algorithm.includes('ECB')) {
    throw new Error('Not supported');
  } else {
    return new CTR(key, iv);
  }
}

export function createCipheriv(algorithm: string, key: Buffer, iv: Buffer) {
  if (algorithm.includes('ECB')) {
    throw new Error('Not supported');
  } else {
    return new CTR(key, iv);
  }
}

export function randomBytes(count: number) {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  return bytes;
}

class Hash {
  private data = new Uint8Array(0);

  constructor(private algorithm: 'sha1' | 'sha256') { }

  update(data: ArrayLike<number>) {
    // We shouldn't be needing new Uint8Array but it doesn't
    // work without it
    this.data = new Uint8Array(data);
  }

  async digest() {
    if (this.algorithm === 'sha1') {
      return Buffer.from(await self.crypto.subtle.digest('SHA-1', this.data));
    } else {
      return Buffer.from(await self.crypto.subtle.digest('SHA-256', this.data));
    }
  }
}

export async function pbkdf2(password: Buffer<ArrayBuffer>, salt: Buffer<ArrayBuffer>, iterations: number) {
  const passwordKey = await crypto.subtle.importKey('raw', password, { name: 'PBKDF2' }, false, ['deriveBits']);
  return Buffer.from(await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-512',
    salt,
    iterations,
  }, passwordKey, 512));
}

export function createHash(algorithm: 'sha1' | 'sha256') {
  return new Hash(algorithm);
}

function writeU32WordsBE(words: Uint32Array, out: Buffer) {
  for (let i = 0; i < words.length; i++) {
    out.writeUInt32BE(words[i], i * 4);
  }
}
