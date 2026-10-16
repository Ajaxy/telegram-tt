import nacl from 'tweetnacl';

import type { BocBudget } from './boc';
import type { Cell } from './cell';

import {
  bufferFromBase64, bufferFromHex, bufferFromUtf8, buffersEqual, bufferToBase64, bufferToHex, concat,
} from '../../util/encoding/buffer';
import { formatAddress, parseAddress, toRawAddress } from './address';
import { createBocBudget, parseBoc, serializeBoc } from './boc';
import { MAX_COINS } from './cell';
import { isRecord, MAINNET, MAX_BODY_BYTES } from './connectRequest';
import { getEd25519PublicKey } from './ed25519';
import { hmacSha512 } from './encryption';
import { signOwnershipProof } from './proof';
import { buildWalletStateInit, WALLET_MAX_BATCH_MESSAGES } from './wallet';

const SESSION_CONTEXT = 'tonconnect/session/v1';
const KEY_BYTES = 32;
const X25519_LOW_BYTE_MASK = 248;
const X25519_HIGH_BYTE_MASK = 127;
const X25519_HIGH_BYTE_BIT = 64;
const NONCE_BYTES = 24;
const TAG_BYTES = 16;
const CHALLENGE_BYTES = KEY_BYTES + NONCE_BYTES + TAG_BYTES + KEY_BYTES;
const MAX_UINT32 = 0xffffffff;
// The server accepts 1 to 100 printable ASCII characters and rejects an id it has already seen in the session
const REQUEST_ID_REGEX = /^[\x20-\x7e]{1,100}$/;
const IMPORT_PROOF_DOMAIN = 'telegram.org';
const TEXT_COMMENT_OPCODE_BITS = 32;
const MAX_COMMENT_BYTES = 1024;
const textDecoder = new TextDecoder('utf-8', { fatal: true });

export type TonConnectSessionKey = {
  secretKey: Uint8Array;
  clientId: string;
};

export type TonConnectRequest = {
  id: string;
  method: string;
  params: string[];
};

export type TonConnectMessage = {
  address: string;
  amount: string;
  payload?: string;
  stateInit?: string;
};

export type TonConnectTransaction = {
  validUntil?: number;
  messages: TonConnectMessage[];
};

export type TonConnectSignData = { type: 'text'; text: string }
  | { type: 'binary'; bytes: string }
  | { type: 'cell'; schema: string; cell: string };

export async function deriveTonConnectSessionKey(
  seed: Uint8Array, dappClientId: string, nonce: Uint8Array,
): Promise<TonConnectSessionKey> {
  if (seed.length !== KEY_BYTES || nonce.length !== KEY_BYTES) throw new Error('Invalid session key input');

  const publicKey = parseClientId(dappClientId);
  const prk = await hmacSha512(new Uint8Array(seed), bufferFromUtf8(SESSION_CONTEXT));
  const okm = await hmacSha512(prk, concat(publicKey, nonce));
  const secretKey = okm.slice(0, KEY_BYTES);
  secretKey[0] &= X25519_LOW_BYTE_MASK;
  secretKey[KEY_BYTES - 1] &= X25519_HIGH_BYTE_MASK;
  secretKey[KEY_BYTES - 1] |= X25519_HIGH_BYTE_BIT;

  return { secretKey, clientId: bufferToHex(nacl.box.keyPair.fromSecretKey(secretKey).publicKey) };
}

// Whether the message, once encrypted, stays within the body size the bridge accepts
export function canEncryptTonConnectMessage(message: unknown) {
  return bufferFromUtf8(JSON.stringify(message)).length + NONCE_BYTES + TAG_BYTES <= MAX_BODY_BYTES;
}

export function encryptTonConnectMessage(
  message: unknown, dappClientId: string, secretKey: Uint8Array,
): Uint8Array<ArrayBuffer> {
  if (!canEncryptTonConnectMessage(message)) throw new Error('Message is too large');

  const plaintext = bufferFromUtf8(JSON.stringify(message));
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));

  return concat(nonce, nacl.box(plaintext, nonce, parseClientId(dappClientId), secretKey));
}

export function decryptTonConnectMessage(
  body: Uint8Array, dappClientId: string, secretKey: Uint8Array,
): unknown {
  if (body.length < NONCE_BYTES + TAG_BYTES || body.length > MAX_BODY_BYTES) throw new Error('Invalid message size');

  const plaintext = nacl.box.open(
    body.subarray(NONCE_BYTES), body.subarray(0, NONCE_BYTES), parseClientId(dappClientId), secretKey,
  );
  if (!plaintext) throw new Error('Invalid encrypted message');

  return JSON.parse(textDecoder.decode(plaintext));
}

export function answerTonConnectChallenge(challenge: Uint8Array, secretKey: Uint8Array): Uint8Array<ArrayBuffer> {
  if (challenge.length !== CHALLENGE_BYTES) throw new Error('Invalid challenge size');

  const answer = nacl.box.open(
    challenge.subarray(KEY_BYTES + NONCE_BYTES),
    challenge.subarray(KEY_BYTES, KEY_BYTES + NONCE_BYTES),
    challenge.subarray(0, KEY_BYTES),
    secretKey,
  );
  if (!answer || answer.length !== KEY_BYTES) throw new Error('Invalid challenge');

  return new Uint8Array(answer);
}

export function parseTonConnectRequest(value: unknown): TonConnectRequest {
  if (!isRecord(value) || typeof value.id !== 'string' || !REQUEST_ID_REGEX.test(value.id)
    || typeof value.method !== 'string' || !value.method
    || !Array.isArray(value.params) || !value.params.every((param) => typeof param === 'string')
    || (value.method === 'disconnect' && value.params.length !== 0)
    || (['sendTransaction', 'signMessage', 'signData'].includes(value.method) && value.params.length !== 1)) {
    throw new Error('Invalid request');
  }

  return { id: value.id, method: value.method, params: value.params };
}

export async function parseTonConnectTransaction(
  value: unknown, ownAddress: string, now: number,
): Promise<TonConnectTransaction> {
  const rawOwnAddress = toRawAddress(ownAddress);

  if (!isRecord(value) || !Array.isArray(value.messages)
    || !rawOwnAddress
    || !value.messages.length || value.messages.length > WALLET_MAX_BATCH_MESSAGES
    || (value.network !== undefined && value.network !== MAINNET)
    || (value.from !== undefined && (typeof value.from !== 'string'
      || toRawAddress(value.from) !== rawOwnAddress))
    || (value.valid_until !== undefined && (typeof value.valid_until !== 'number'
      || !Number.isInteger(value.valid_until) || value.valid_until <= now || value.valid_until > MAX_UINT32))) {
    throw new Error('Invalid transaction');
  }

  const messages: TonConnectMessage[] = [];
  const bocBudget = createBocBudget();

  for (const message of value.messages) {
    if (!isRecord(message) || typeof message.address !== 'string' || typeof message.amount !== 'string'
      || !/^\d{1,37}$/.test(message.amount) || BigInt(message.amount) >= MAX_COINS
      || message.extraCurrency !== undefined || message.extra_currency !== undefined) {
      throw new Error('Invalid transaction message');
    }

    const address = parseAddress(message.address);
    if (!address || address.isTestOnly) throw new Error('Invalid recipient');

    const payload = await parseOptionalBoc(message.payload, bocBudget);
    const stateInit = await parseOptionalBoc(message.stateInit, bocBudget);

    if (stateInit) {
      validateStateInit(stateInit);

      // A state init that does not hash to the recipient deploys nothing, and money sent that way is stranded
      if (!buffersEqual(stateInit.hash, address.hash)) throw new Error('State init does not match the recipient');
    }

    messages.push({
      // The user-friendly form keeps the bounce flag the transfer builder reads; a raw address is bounceable
      address: formatAddress(address.workchain, address.hash, address.isBounceable),
      amount: message.amount,
      payload: payload ? bufferToBase64(serializeBoc(payload)) : undefined,
      stateInit: stateInit ? bufferToBase64(serializeBoc(stateInit)) : undefined,
    });
  }

  return { validUntil: value.valid_until, messages };
}

export async function parseTonConnectSignData(value: unknown, ownAddress: string): Promise<TonConnectSignData> {
  const rawOwnAddress = toRawAddress(ownAddress);

  if (!isRecord(value) || !rawOwnAddress
    || (value.network !== undefined && value.network !== MAINNET)
    || (value.from !== undefined && (typeof value.from !== 'string' || toRawAddress(value.from) !== rawOwnAddress))) {
    throw new Error('Invalid sign data');
  }

  if (value.type === 'text' && typeof value.text === 'string') {
    return { type: 'text', text: value.text };
  }

  if (value.type === 'binary' && typeof value.bytes === 'string') {
    // Throws on invalid base64
    bufferFromBase64(value.bytes);

    return { type: 'binary', bytes: value.bytes };
  }

  if (value.type === 'cell' && typeof value.schema === 'string' && typeof value.cell === 'string') {
    await parseBoc(value.cell);

    return { type: 'cell', schema: value.schema, cell: value.cell };
  }
  throw new Error('Invalid sign data');
}

export function getTonConnectDomain(manifestUrl: string) {
  const manifest = new URL(manifestUrl);
  if (manifest.protocol !== 'https:') throw new Error('Invalid manifest URL');

  return validateProofDomain(manifest.hostname.toLowerCase());
}

// The server's own ownership proof (`wallet.getProofChallenge`) has the same format, and only the domain
// tells them apart: a dApp claiming that domain could collect a proof that imports the wallet elsewhere
export function validateProofDomain(domain: string) {
  if (domain.toLowerCase().replace(/\.$/, '') === IMPORT_PROOF_DOMAIN) throw new Error('Reserved proof domain');

  return domain;
}

// The `ton_proof` signature also comes back on its own: a login through Telegram sends it as `walletOwnershipProof`
export async function buildTonConnectEvent({
  id, address, anchorPublicKey, signingSeed, domain, items, timestamp, appVersion,
}: {
  id: number;
  address: string;
  anchorPublicKey: Uint8Array;
  signingSeed: Uint8Array;
  domain: string;
  items: unknown[];
  timestamp: number;
  appVersion: string;
}) {
  if (!Number.isSafeInteger(id) || id < 0) throw new Error('Invalid event ID');

  const parsedAddress = parseAddress(address);
  if (!parsedAddress || parsedAddress.isTestOnly) throw new Error('Invalid wallet address');

  const stateInit = await buildWalletStateInit(anchorPublicKey);

  if (!buffersEqual(stateInit.hash, parsedAddress.hash) || parsedAddress.workchain !== 0) {
    throw new Error('State init does not match the wallet');
  }

  let proofSignature: Uint8Array<ArrayBuffer> | undefined;
  const replies = await Promise.all(items.map(async (item) => {
    if (!isRecord(item) || typeof item.name !== 'string') throw new Error('Invalid connect item');

    if (item.name === 'ton_addr') {
      if (item.network !== undefined && item.network !== MAINNET) throw new Error('Unsupported network');

      return {
        name: item.name,
        address: toRawAddress(address)!,
        network: MAINNET,
        walletStateInit: bufferToBase64(serializeBoc(stateInit)),
        publicKey: bufferToHex(await getEd25519PublicKey(signingSeed)),
      };
    }

    if (item.name === 'ton_proof') {
      if (typeof item.payload !== 'string') throw new Error('Invalid proof payload');

      // A dApp under development runs on `localhost`, which has no dot
      const isDomainValid = domain === 'localhost'
        || (domain.includes('.') && domain.split('.').every(Boolean));
      if (!isDomainValid) throw new Error('Invalid proof domain');

      proofSignature = await signOwnershipProof({
        address: parsedAddress, domain, timestamp, payload: item.payload, seed: signingSeed,
      });

      return {
        name: item.name,
        proof: {
          timestamp,
          domain: { lengthBytes: bufferFromUtf8(domain).length, value: domain },
          payload: item.payload,
          signature: bufferToBase64(proofSignature),
        },
      };
    }

    return { name: item.name, error: { code: 400, message: 'Method not supported' } };
  }));

  const event = {
    event: 'connect',
    id,
    payload: {
      items: replies,
      // dApps look the wallet up by `appName` in the TON Connect wallets registry (`wallets-v2.json`),
      // where this wallet is `telegram`
      device: {
        platform: 'browser', appName: 'telegram', appVersion, maxProtocolVersion: 2,
        features: [
          { name: 'SendTransaction', maxMessages: WALLET_MAX_BATCH_MESSAGES },
          { name: 'SignMessage', maxMessages: WALLET_MAX_BATCH_MESSAGES },
          { name: 'SignData', types: ['text', 'binary', 'cell'] },
        ],
      },
    },
  };

  return { event, proofSignature };
}

export function buildTonConnectError(id: string, code: number, message: string) {
  return { error: { code, message }, id };
}

export function buildTonConnectConnectError(id: number, code: number, message: string) {
  if (!Number.isSafeInteger(id) || id < 0) throw new Error('Invalid event ID');

  return { event: 'connect_error', id, payload: { code, message } };
}

export async function readTonConnectComment(payload: string): Promise<string | undefined> {
  let cell = await parseBoc(payload);

  if (cell.bits.length < TEXT_COMMENT_OPCODE_BITS || cell.bits.slice(0, TEXT_COMMENT_OPCODE_BITS).some(Boolean)) {
    return undefined;
  }

  const bytes: number[] = [];
  let offset = TEXT_COMMENT_OPCODE_BITS;

  while (true) {
    if ((cell.bits.length - offset) % 8 || cell.refs.length > 1) return undefined;

    for (; offset < cell.bits.length; offset += 8) {
      bytes.push(cell.bits.slice(offset, offset + 8).reduce((value, bit) => value * 2 + bit, 0));

      if (bytes.length > MAX_COMMENT_BYTES) return undefined;
    }

    if (!cell.refs.length) break;

    [cell] = cell.refs;
    offset = 0;
  }

  try {
    return textDecoder.decode(new Uint8Array(bytes));
  } catch {
    return undefined;
  }
}

function parseClientId(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[a-f\d]{64}$/i.test(value)) throw new Error('Invalid dApp client ID');

  return bufferFromHex(value);
}

async function parseOptionalBoc(value: unknown, budget?: BocBudget): Promise<Cell | undefined> {
  if (value === undefined) return undefined;

  if (typeof value !== 'string' || !value) throw new Error('Invalid BOC');

  return parseBoc(value, budget);
}

// Without code the recipient gets an account that can never be deployed, and money sent along is stranded
function validateStateInit(cell: Cell) {
  let offset = 0;
  let refs = 0;
  if (cell.bits[offset++]) offset += 5; // Optional split depth

  if (cell.bits[offset++]) offset += 2; // Optional special flags

  const hasCode = Boolean(cell.bits[offset]);
  for (let i = 0; i < 3; i++) refs += cell.bits[offset++] || 0; // Code, data, libraries

  if (offset !== cell.bits.length || refs !== cell.refs.length) throw new Error('Invalid state init');

  if (!hasCode) throw new Error('State init has no code');
}
