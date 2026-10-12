import type { TonAddress } from './address';
import type { Cell } from './cell';

import { bufferToBase64 } from '../../util/encoding/buffer';
import { formatAddress } from './address';
import { parseBoc, serializeBoc } from './boc';
import { Builder } from './cell';
import { signEd25519 } from './ed25519';
import { ENCRYPTED_COMMENT_OPCODE } from './encryption';

// The `WalletTg` trampoline (https://github.com/ton-blockchain/tg-wallet-contract): jumps to the code in `config[-123]`
const WALLET_TG_TRAMPOLINE_BOC = 'te6cckEBAQEAGgAAMP8AIJgh10mDCLnyQN+Ahfgz0O0eIO1T2WlCfjk=';

// Mainnet; testnet is 0x7FFF7FFD
const WALLET_TG_SUBWALLET_ID = 0x7FFF7F11;
const WALLET_TG_STORAGE_REVISION = 0;
// The same request arriving as an external message or, when gasless, inside an internal one from the relayer
const OP_SEND_ONE_EXTERNAL = 0x63896E75;
const OP_SEND_ONE_INTERNAL = 0x63896E74;
const OP_SEND_BULK_EXTERNAL = 0x73896E75;
const OP_SEND_BULK_INTERNAL = 0x73896E74;
// The new key proves it exists by signing the address, see `buildKeyRotationProof`
const OP_CHANGE_KEY_EXTERNAL = 0xFBBA99C8;
const KEY_ROTATION_PROOF_PREFIX = 'KEY_ROTATION';
// Salts the mask over the previous signing seed, so it differs from the new seed itself
const KEY_CHANGE_SALT = 'keyChangeSaltV1';
const SIGNING_SEED_BYTES = 32;
const WORKCHAIN_BITS = 8;
const UINT32_BITS = 32;
const UINT8_BITS = 8;

export const TRANSFER_TTL_SECONDS = 120;
// The contract reads `validUntil` as a `uint32`
const MAX_VALID_UNTIL = 0xFFFFFFFF;
// The message count of a bulk request is a `uint8`
export const WALLET_MAX_BATCH_MESSAGES = 255;
// A linked chunk spends one of its four refs on the link to the next one
const MESSAGES_PER_LINKED_CHUNK = 3;
const MESSAGES_PER_LAST_CHUNK = 4;
// Pay fees separately and ignore action errors
const SEND_MODE = 3;
// Carry the whole balance, fees included, and ignore action errors
const SEND_ALL_MODE = 130;
const TEXT_COMMENT_OPCODE = 0;
// TEP-62 `transfer`
const NFT_TRANSFER_OPCODE = 0x5fcc3d14;
// A cell fits 1023 bits; the first comment cell also carries the 32-bit opcode
const COMMENT_FIRST_CHUNK_BYTES = 123;
const COMMENT_CHUNK_BYTES = 127;
const MAX_MESSAGE_REFS = 4;
// A fee estimate with `ignore_chksig` only needs a signature of the right size
const SIGNATURE_BYTES = 64;

type TransferBodyParams = {
  to: TonAddress;
  // Nanotons
  amount: bigint;
  seqno: number;
  // Unix seconds of the server clock; the transfer expires `TRANSFER_TTL_SECONDS` later
  now: number;
  comment?: string;
  encryptedComment?: Uint8Array;
  // `amount` then only sets the message value shown before the fees are taken
  shouldSendAll?: boolean;
  isGasless?: boolean;
  payload?: Cell;
};

type SignedTransferParams = TransferBodyParams & {
  secretSeed: Uint8Array;
};

type GaslessTransferParams = SignedTransferParams & {
  ownAddress: TonAddress;
};

type TransferParams = SignedTransferParams & {
  ownAddress: TonAddress;
  publicKey: Uint8Array;
  shouldDeploy?: boolean;
};

type KeyRotationBodyParams = {
  ownAddress: TonAddress;
  seqno: number;
  // Unix seconds of the server clock; the request expires `TRANSFER_TTL_SECONDS` later
  now: number;
  newPublicKey: Uint8Array;
  encryptedOldSeed: Uint8Array;
};

type KeyRotationParams = Omit<KeyRotationBodyParams, 'encryptedOldSeed'> & {
  secretSeed: Uint8Array;
  newSecretSeed: Uint8Array;
};

type WalletBatchMessage = {
  to: TonAddress;
  amount: bigint;
  payload?: Cell;
  stateInit?: Cell;
};

type WalletBatchBodyParams = {
  messages: WalletBatchMessage[];
  seqno: number;
  now: number;
  validUntil?: number;
  // The internal opcode, which the contract only accepts inside an internal message
  isInternal?: boolean;
};

type WalletBatchMessageParams = WalletBatchBodyParams & {
  ownAddress: TonAddress;
  anchorPublicKey: Uint8Array;
  shouldDeploy?: boolean;
};

type WalletBatchTransferParams = WalletBatchMessageParams & {
  secretSeed: Uint8Array;
};

let codeCellPromise: Promise<Cell> | undefined;

function getCodeCell(): Promise<Cell> {
  codeCellPromise ||= parseBoc(WALLET_TG_TRAMPOLINE_BOC);

  return codeCellPromise;
}

function buildWalletDataCell(publicKey: Uint8Array): Promise<Cell> {
  return new Builder()
    .storeUint(WALLET_TG_STORAGE_REVISION, 8)
    .storeUint(0, 32) // Seqno
    .storeUint(WALLET_TG_SUBWALLET_ID, 32)
    .storeBytes(publicKey)
    .build();
}

export async function buildWalletInitBocs(publicKey: Uint8Array): Promise<{ code: string; data: string }> {
  const [code, data] = await Promise.all([getCodeCell(), buildWalletDataCell(publicKey)]);

  return {
    code: bufferToBase64(serializeBoc(code)),
    data: bufferToBase64(serializeBoc(data)),
  };
}

export async function buildWalletStateInit(publicKey: Uint8Array): Promise<Cell> {
  const dataCell = await buildWalletDataCell(publicKey);

  return new Builder()
    .storeBit(0) // No split depth
    .storeBit(0) // Not special
    .storeBit(1)
    .storeRef(await getCodeCell())
    .storeBit(1)
    .storeRef(dataCell)
    .storeBit(0) // No libraries
    .build();
}

export async function deriveWalletAddress(publicKey: Uint8Array): Promise<string> {
  const stateInit = await buildWalletStateInit(publicKey);

  return formatAddress(0, stateInit.hash);
}

export async function buildSignedTransfer({
  ownAddress, publicKey, shouldDeploy, secretSeed, ...bodyParams
}: TransferParams): Promise<Uint8Array<ArrayBuffer>> {
  const body = await buildSignedTransferBody(bodyParams, secretSeed);
  const stateInit = shouldDeploy ? await buildWalletStateInit(publicKey) : undefined;

  return serializeBoc(await buildExternalMessage(ownAddress, body, stateInit));
}

export function buildSignedBatchTransfer({ secretSeed, ...params }: WalletBatchTransferParams) {
  return buildBatchTransfer(params, secretSeed);
}

// An internal message addressed to the wallet itself; whoever sends it pays the gas
export function buildSignedInternalBatchTransfer({ secretSeed, ...params }: WalletBatchTransferParams) {
  return buildBatchTransfer({ ...params, isInternal: true }, secretSeed);
}

// A blank signature takes the same 64 bytes, so the size is known before the key is unlocked
export async function getBatchTransferSize(params: WalletBatchMessageParams): Promise<number> {
  return (await buildBatchTransfer(params)).length;
}

async function buildBatchTransfer(
  { ownAddress, anchorPublicKey, shouldDeploy, ...bodyParams }: WalletBatchMessageParams, secretSeed?: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const unsignedBody = await buildUnsignedBatchTransferBody(bodyParams);
  const signature = secretSeed ? await signEd25519(unsignedBody.hash, secretSeed) : new Uint8Array(SIGNATURE_BYTES);
  const body = await attachSignature(unsignedBody, signature);
  const stateInit = shouldDeploy ? await buildWalletStateInit(anchorPublicKey) : undefined;

  if (!bodyParams.isInternal) {
    return serializeBoc(await buildExternalMessage(ownAddress, body, stateInit));
  }

  // The relayer pays for this message, so a failure must not send its coins back
  return serializeBoc(await buildInternalMessage(
    { ...ownAddress, isBounceable: false }, 0n, undefined, undefined, body, stateInit,
  ));
}

export async function buildUnsignedBatchTransferBodyBoc(params: WalletBatchBodyParams): Promise<string> {
  const body = await attachSignature(await buildUnsignedBatchTransferBody(params), new Uint8Array(SIGNATURE_BYTES));

  return bufferToBase64(serializeBoc(body));
}

async function buildUnsignedBatchTransferBody({
  messages, seqno, now, validUntil = now + TRANSFER_TTL_SECONDS, isInternal,
}: WalletBatchBodyParams): Promise<Cell> {
  if (!messages.length || messages.length > WALLET_MAX_BATCH_MESSAGES) throw new Error('Invalid batch size');

  if (!Number.isInteger(validUntil) || validUntil <= now) throw new Error('Transaction expired');

  if (validUntil > MAX_VALID_UNTIL) throw new Error('Expiration exceeds the wallet field');

  const internalMessages = await Promise.all(messages.map(({ to, amount, payload, stateInit }) => {
    if (amount < 0n) throw new Error('Invalid amount');

    return buildInternalMessage(to, amount, undefined, undefined, payload, stateInit);
  }));
  const opcode = messages.length === 1
    ? (isInternal ? OP_SEND_ONE_INTERNAL : OP_SEND_ONE_EXTERNAL)
    : (isInternal ? OP_SEND_BULK_INTERNAL : OP_SEND_BULK_EXTERNAL);
  const builder = new Builder()
    .storeUint(opcode, UINT32_BITS)
    .storeUint(WALLET_TG_SUBWALLET_ID, UINT32_BITS)
    .storeUint(validUntil, UINT32_BITS)
    .storeUint(seqno, UINT32_BITS);
  if (messages.length === 1) return builder.storeUint(SEND_MODE, UINT8_BITS).storeRef(internalMessages[0]).build();

  return builder
    .storeUint(messages.length, UINT8_BITS)
    .storeBit(1)
    .storeRef(await buildMessageArrayChunks(internalMessages))
    .build();
}

// A chunk starts with an optional ref to the next one, then its messages in order; built from the tail
async function buildMessageArrayChunks(internalMessages: Cell[]): Promise<Cell> {
  const chunkSizes: number[] = [];
  let rest = internalMessages.length;

  for (; rest > MESSAGES_PER_LAST_CHUNK; rest -= MESSAGES_PER_LINKED_CHUNK) {
    chunkSizes.push(MESSAGES_PER_LINKED_CHUNK);
  }

  chunkSizes.push(rest);

  let next: Cell | undefined;
  let end = internalMessages.length;

  for (const size of chunkSizes.reverse()) {
    const chunk = next ? new Builder().storeBit(1).storeRef(next) : new Builder().storeBit(0);

    for (const message of internalMessages.slice(end - size, end)) {
      chunk.storeUint(SEND_MODE, UINT8_BITS).storeRef(message);
    }

    next = await chunk.build();
    end -= size;
  }

  return next!;
}

// TEP-62 `transfer`: the attached coins beyond `forwardAmount` go back to `responseDestination`
export async function buildNftTransferPayload({
  newOwner, responseDestination, forwardAmount, comment,
}: {
  newOwner: TonAddress;
  responseDestination: TonAddress;
  // Nanotons
  forwardAmount: bigint;
  comment?: string;
}): Promise<Cell> {
  const builder = new Builder()
    .storeUint(NFT_TRANSFER_OPCODE, 32)
    .storeUint(0, 64) // Query id
    .storeAddress(newOwner.workchain, newOwner.hash)
    .storeAddress(responseDestination.workchain, responseDestination.hash)
    .storeBit(0) // No custom payload
    .storeCoins(forwardAmount);

  // `Either Cell ^Cell`: a comment goes into a ref (bit 1), an empty notification is inline (bit 0)
  if (!comment) return builder.storeBit(0).build();

  const notification = await buildSnakeCell(TEXT_COMMENT_OPCODE, new TextEncoder().encode(comment));

  return builder.storeBit(1).storeRef(notification).build();
}

export async function buildSignedKeyRotation({
  secretSeed, newSecretSeed, ...bodyParams
}: KeyRotationParams): Promise<Uint8Array<ArrayBuffer>> {
  const proof = await signEd25519(await buildKeyRotationProof(bodyParams.ownAddress), newSecretSeed);
  const encryptedOldSeed = await encryptPreviousSigningSeed(secretSeed, newSecretSeed);
  const unsignedBody = await buildUnsignedKeyRotationBody({ ...bodyParams, encryptedOldSeed }, proof);
  const body = await attachSignature(unsignedBody, await signEd25519(unsignedBody.hash, secretSeed));

  return serializeBoc(await buildExternalMessage(bodyParams.ownAddress, body));
}

export async function buildUnsignedKeyRotationBodyBoc(
  params: Omit<KeyRotationBodyParams, 'encryptedOldSeed'>,
): Promise<string> {
  // Blank bytes make the published cell count towards the estimate
  const encryptedOldSeed = new Uint8Array(SIGNING_SEED_BYTES);
  const unsignedBody = await buildUnsignedKeyRotationBody(
    { ...params, encryptedOldSeed }, new Uint8Array(SIGNATURE_BYTES),
  );
  const body = await attachSignature(unsignedBody, new Uint8Array(SIGNATURE_BYTES));

  return bufferToBase64(serializeBoc(body));
}

async function buildExternalMessage(ownAddress: TonAddress, body: Cell, stateInit?: Cell): Promise<Cell> {
  const external = new Builder()
    .storeUint(2, 2) // `ext_in_msg_info$10`
    .storeUint(0, 2) // Source: `addr_none`
    .storeAddress(ownAddress.workchain, ownAddress.hash)
    .storeCoins(0n); // Import fee

  if (stateInit) {
    external.storeBit(1); // State init present

    // Inline when it fits, matching the reference `storeMessage` behavior
    if (external.availableBits - 2 < stateInit.bits.length + body.bits.length) {
      external.storeBit(1).storeRef(stateInit);
    } else {
      external.storeBit(0).storeCellInline(stateInit);
    }
  } else {
    external.storeBit(0);
  }

  const shouldUseBodyRef = external.availableBits - 1 < body.bits.length
    || external.refCount + body.refs.length > MAX_MESSAGE_REFS;

  if (shouldUseBodyRef) {
    external.storeBit(1).storeRef(body);
  } else {
    external.storeBit(0).storeCellInline(body);
  }

  return external.build();
}

// The new key's signature of the address keeps a rotation to a key nobody holds from landing; the masked
// previous seed lets a client that knows the current seed read comments sent to an older key
async function buildUnsignedKeyRotationBody({
  ownAddress, seqno, now, newPublicKey, encryptedOldSeed,
}: KeyRotationBodyParams, proof: Uint8Array): Promise<Cell> {
  return new Builder()
    .storeUint(OP_CHANGE_KEY_EXTERNAL, 32)
    .storeUint(WALLET_TG_SUBWALLET_ID, 32)
    .storeUint(now + TRANSFER_TTL_SECONDS, 32)
    .storeUint(seqno, 32)
    .storeBytes(newPublicKey)
    .storeRef(await new Builder().storeBytes(proof).build())
    .storeRef(await new Builder().storeBytes(encryptedOldSeed).build())
    .build();
}

// XOR with `SHA-256(newSeed || salt)`, its own inverse, so the same call unmasks a published seed
export async function encryptPreviousSigningSeed(
  oldSeed: Uint8Array, newSeed: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const mask = await buildSigningSeedMask(newSeed);

  return oldSeed.map((byte, i) => byte ^ mask[i]);
}

async function buildSigningSeedMask(seed: Uint8Array) {
  const salted = new Uint8Array(seed.length + KEY_CHANGE_SALT.length);
  salted.set(seed);
  salted.set(new TextEncoder().encode(KEY_CHANGE_SALT), seed.length);

  return new Uint8Array(await crypto.subtle.digest('SHA-256', salted));
}

// The prefix, the workchain as a signed byte and the account id
async function buildKeyRotationProof(ownAddress: TonAddress): Promise<Uint8Array<ArrayBuffer>> {
  const cell = await new Builder()
    .storeBytes(new TextEncoder().encode(KEY_ROTATION_PROOF_PREFIX))
    .storeUint(ownAddress.workchain & ((1 << WORKCHAIN_BITS) - 1), WORKCHAIN_BITS)
    .storeBytes(ownAddress.hash)
    .build();

  return cell.hash;
}

export async function buildSignedGaslessTransfer({
  secretSeed, ownAddress, ...bodyParams
}: GaslessTransferParams): Promise<Uint8Array<ArrayBuffer>> {
  const body = await buildSignedTransferBody({ ...bodyParams, isGasless: true }, secretSeed);

  return serializeBoc(await buildInternalMessage(
    { ...ownAddress, isBounceable: false }, 0n, undefined, undefined, body,
  ));
}

export async function buildUnsignedTransferBodyBoc(params: TransferBodyParams): Promise<string> {
  const unsignedBody = await buildUnsignedTransferBody(params);
  const body = await attachSignature(unsignedBody, new Uint8Array(SIGNATURE_BYTES));

  return bufferToBase64(serializeBoc(body));
}

async function buildSignedTransferBody(params: TransferBodyParams, secretSeed: Uint8Array): Promise<Cell> {
  const unsignedBody = await buildUnsignedTransferBody(params);

  // `WalletTg` puts the signature before the payload, unlike wallet v5
  const signature = await signEd25519(unsignedBody.hash, secretSeed);

  return attachSignature(unsignedBody, signature);
}

// Opcode, anti-replay header, then the message; the signature covers the hash of exactly this cell
async function buildUnsignedTransferBody({
  to, amount, seqno, now, comment, encryptedComment, shouldSendAll, isGasless, payload,
}: TransferBodyParams): Promise<Cell> {
  const validUntil = now + TRANSFER_TTL_SECONDS;

  const internalMessage = await buildInternalMessage(to, amount, comment, encryptedComment, payload);

  return new Builder()
    .storeUint(isGasless ? OP_SEND_ONE_INTERNAL : OP_SEND_ONE_EXTERNAL, 32)
    .storeUint(WALLET_TG_SUBWALLET_ID, 32)
    .storeUint(validUntil, 32)
    .storeUint(seqno, 32)
    .storeUint(shouldSendAll ? SEND_ALL_MODE : SEND_MODE, 8)
    .storeRef(internalMessage)
    .build();
}

function attachSignature(unsignedBody: Cell, signature: Uint8Array): Promise<Cell> {
  return new Builder().storeBytes(signature).storeCellInline(unsignedBody).build();
}

async function buildInternalMessage(
  to: TonAddress, amount: bigint, comment?: string, encryptedComment?: Uint8Array,
  payload?: Cell, stateInit?: Cell,
): Promise<Cell> {
  const builder = new Builder()
    .storeBit(0) // `int_msg_info$0`
    .storeBit(1) // IHR disabled
    .storeBit(to.isBounceable ? 1 : 0)
    .storeBit(0) // Not bounced
    .storeUint(0, 2) // Source: `addr_none`
    .storeAddress(to.workchain, to.hash)
    .storeCoins(amount)
    .storeBit(0) // No extra currencies
    .storeCoins(0n) // IHR fee
    .storeCoins(0n) // Forward fee
    .storeUint(0, 64) // Created LT
    .storeUint(0, 32); // Created at

  if (stateInit) builder.storeBit(1).storeBit(1).storeRef(stateInit);
  else builder.storeBit(0);

  if (!comment && !encryptedComment && !payload) {
    return builder.storeBit(0).build();
  }

  const commentCell = payload || (encryptedComment
    ? await buildSnakeCell(ENCRYPTED_COMMENT_OPCODE, encryptedComment)
    : await buildSnakeCell(TEXT_COMMENT_OPCODE, new TextEncoder().encode(comment)));

  // Inline the body when it fits, matching the reference `storeMessage` behavior
  const shouldUseRef = builder.availableBits - 1 < commentCell.bits.length
    || builder.refCount + commentCell.refs.length > MAX_MESSAGE_REFS;

  if (shouldUseRef) {
    return builder.storeBit(1).storeRef(commentCell).build();
  }

  return builder.storeBit(0).storeCellInline(commentCell).build();
}

// `SnakeData`: the opcode and the first chunk in the root cell, the rest chained through single refs
async function buildSnakeCell(opcode: number, bytes: Uint8Array): Promise<Cell> {
  const chunks: Uint8Array[] = [bytes.subarray(0, COMMENT_FIRST_CHUNK_BYTES)];

  for (let offset = COMMENT_FIRST_CHUNK_BYTES; offset < bytes.length; offset += COMMENT_CHUNK_BYTES) {
    chunks.push(bytes.subarray(offset, offset + COMMENT_CHUNK_BYTES));
  }

  let tail: Cell | undefined;

  for (let i = chunks.length - 1; i > 0; i--) {
    const builder = new Builder().storeBytes(chunks[i]);

    if (tail) {
      builder.storeRef(tail);
    }

    tail = await builder.build();
  }

  const rootBuilder = new Builder()
    .storeUint(opcode, 32)
    .storeBytes(chunks[0]);

  if (tail) {
    rootBuilder.storeRef(tail);
  }

  return rootBuilder.build();
}
