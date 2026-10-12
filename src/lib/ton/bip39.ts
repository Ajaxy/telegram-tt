// A BIP-39 phrase yields the ed25519 key along SLIP-0010 at TON's `m/44'/607'/0'`, as MyTonWallet and Tonkeeper do.
// The anchor key derives the address and stays through rotations; the signing key signs and gets replaced.

import { BIP39_WORD_INDEXES, BIP39_WORDLIST } from './bip39Wordlist';
import { hmacSha512 } from './encryption';

const SEED_SALT = 'mnemonic';
const TON_SEED_SALT = 'TON default seed';
const TON_SEED_VERSION_SALT = 'TON seed version';
const TON_SEED_ITERATIONS = 100000;
// The phrase version is checked, as in tonlib, with a short run of the same PBKDF2
const TON_SEED_VERSION_ITERATIONS = Math.max(1, Math.floor(TON_SEED_ITERATIONS / 256));
const SEED_ITERATIONS = 2048;
const CURVE_SEED = 'ed25519 seed';
const HARDENED_OFFSET = 0x80000000;
const TON_PATH = [44, 607, 0];
export const PHRASE_WORD_COUNT = 12;
export const COMPOSITE_WORD_COUNT = PHRASE_WORD_COUNT * 2;
const textEncoder = new TextEncoder();

// A BIP-39 word carries 11 bits; 12 words are 128 bits of entropy and a 4-bit checksum
const ENTROPY_BYTES = 16;
const CHECKSUM_BITS = 4;
const WORD_BITS = 11;
const WORD_BITS_PER_CHECKSUM_BIT = 33;

export type WalletSeeds = {
  anchor: Uint8Array<ArrayBuffer>;
  signing: Uint8Array<ArrayBuffer>;
};

export async function deriveImportedWalletSeeds(words: string[]): Promise<WalletSeeds | undefined> {
  if (![PHRASE_WORD_COUNT, COMPOSITE_WORD_COUNT].includes(words.length)
    || words.some((word) => !BIP39_WORD_INDEXES.has(word))) {
    return undefined;
  }

  // Checked first: one phrase in 256 also passes the TON version stretch by chance, and every Telegram phrase is BIP-39
  if (await areBip39Halves(words)) {
    return deriveBip39MnemonicSeeds(words);
  }

  if (words.length !== COMPOSITE_WORD_COUNT) {
    return undefined;
  }

  if (await isBip39Mnemonic(words)) {
    return deriveWholeBip39MnemonicSeeds(words);
  }

  return (await isTonMnemonic(words)) ? deriveTonMnemonicSeeds(words) : undefined;
}

async function areBip39Halves(words: string[]): Promise<boolean> {
  for (let offset = 0; offset < words.length; offset += PHRASE_WORD_COUNT) {
    if (!(await isBip39Mnemonic(words.slice(offset, offset + PHRASE_WORD_COUNT)))) return false;
  }

  return true;
}

export async function isBip39Mnemonic(words: string[]): Promise<boolean> {
  const checksumBits = (words.length * WORD_BITS) / WORD_BITS_PER_CHECKSUM_BIT;
  const entropyBytes = (checksumBits * 32) / 8;
  const bits = words.map((word) => BIP39_WORD_INDEXES.get(word)!.toString(2).padStart(WORD_BITS, '0')).join('');
  const entropy = Uint8Array.from({ length: entropyBytes }, (_, index) => (
    parseInt(bits.slice(index * 8, (index + 1) * 8), 2)
  ));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', entropy));

  return parseInt(bits.slice(entropyBytes * 8), 2) === hash[0] >> (8 - checksumBits);
}

// HMAC of the phrase stretched with PBKDF2-SHA512 and the `TON default seed` salt into one seed for both roles
export async function deriveTonMnemonicSeeds(words: string[]): Promise<WalletSeeds> {
  const bits = await stretchTonEntropy(words, TON_SEED_SALT, TON_SEED_ITERATIONS);
  const seed = bits.slice(0, 32);

  return { anchor: seed, signing: seed };
}

// A tonlib phrase has a zero first byte in its version stretch
export async function isTonMnemonic(words: string[]): Promise<boolean> {
  const bits = await stretchTonEntropy(words, TON_SEED_VERSION_SALT, TON_SEED_VERSION_ITERATIONS);

  return bits[0] === 0;
}

async function stretchTonEntropy(
  words: string[], salt: string, iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const entropy = await hmacSha512(textEncoder.encode(words.join(' ')), new Uint8Array(0));
  const key = await crypto.subtle.importKey('raw', entropy, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-512',
    salt: textEncoder.encode(salt),
    iterations,
  }, key, 512);

  return new Uint8Array(bits);
}

// A 24-word phrase is two 12-word phrases, the anchor half first, so a rotated wallet keeps its address
export async function deriveBip39MnemonicSeeds(words: string[]): Promise<WalletSeeds> {
  if (words.length !== COMPOSITE_WORD_COUNT) {
    return deriveWholeBip39MnemonicSeeds(words);
  }

  return {
    anchor: await bip39MnemonicToSeed(words.slice(0, PHRASE_WORD_COUNT)),
    signing: await bip39MnemonicToSeed(words.slice(PHRASE_WORD_COUNT)),
  };
}

export async function deriveWholeBip39MnemonicSeeds(words: string[]): Promise<WalletSeeds> {
  const seed = await bip39MnemonicToSeed(words);

  return { anchor: seed, signing: seed };
}

async function bip39MnemonicToSeed(words: string[]): Promise<Uint8Array<ArrayBuffer>> {
  const seed = await deriveBip39Seed(words);
  let node = await hmacSha512(textEncoder.encode(CURVE_SEED), seed);

  for (const index of TON_PATH) {
    node = await deriveChild(node, index);
  }

  return node.slice(0, 32);
}

async function deriveBip39Seed(words: string[]): Promise<Uint8Array<ArrayBuffer>> {
  // NFKD is a no-op for the English wordlist, but BIP-39 asks for it
  const key = await crypto.subtle.importKey(
    'raw', textEncoder.encode(words.join(' ').normalize('NFKD')), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-512',
    salt: textEncoder.encode(SEED_SALT),
    iterations: SEED_ITERATIONS,
  }, key, 512);

  return new Uint8Array(bits);
}

// Only hardened derivation exists for ed25519, so the private key is always prefixed with a zero byte
async function deriveChild(node: Uint8Array<ArrayBuffer>, index: number): Promise<Uint8Array<ArrayBuffer>> {
  const data = new Uint8Array(37);
  data.set(node.slice(0, 32), 1);
  new DataView(data.buffer).setUint32(33, index + HARDENED_OFFSET, false);

  return hmacSha512(node.slice(32), data);
}

export async function generateBip39Mnemonic(): Promise<string[]> {
  const entropy = crypto.getRandomValues(new Uint8Array(ENTROPY_BYTES));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', entropy));
  const bits = Array.from(entropy, (byte) => byte.toString(2).padStart(8, '0')).join('')
    + (hash[0] >> (8 - CHECKSUM_BITS)).toString(2).padStart(CHECKSUM_BITS, '0');

  const words: string[] = [];

  for (let offset = 0; offset < bits.length; offset += WORD_BITS) {
    words.push(BIP39_WORDLIST[parseInt(bits.slice(offset, offset + WORD_BITS), 2)]);
  }

  return words;
}
