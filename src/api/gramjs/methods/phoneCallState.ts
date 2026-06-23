import { gunzipSync, gzipSync } from 'fflate';
import { CTR } from '../../../lib/gramjs/crypto/CTR';
import { SecurityError } from '../../../lib/gramjs/errors';
import {
  DH_PRIME_BYTES,
  generateDhPrivateExponent,
  modExp,
  readBigIntFromBuffer,
  readBufferFromBigInt,
  sha1,
  sha256,
  validateDhParameters,
  validateDhPublicValue,
} from '../../../lib/gramjs/Helpers';

import {
  bufferFromUtf8, buffersEqual, bufferToUtf8, concat, readUint32BE, writeUint32BE,
} from '../../../util/encoding/buffer';
import { isSctpPacket, SctpSignaling } from './sctpSignaling';

const SHA256_HASH_BYTES = 32;

type DhConfig = {
  p: number[];
  g: number;
  random: number[];
};

type ConfirmCallParams = {
  gAOrB: number[];
  emojiData: Uint16Array;
  emojiOffsets: number[];
  gAHash?: number[];
  expectedKeyFingerprint?: string;
};

type VerifyKeyFingerprintParams = {
  expectedKeyFingerprint: string;
};

type PhoneCallDataParams = {
  data: unknown;
};

type DecodePhoneCallDataParams = {
  data: number[];
};

let currentPhoneCallState: PhoneCallState | undefined;

class PhoneCallState {
  private authKey?: Uint8Array;

  private sctp = new SctpSignaling();

  private seq = 0;

  private maxInboundSeq = 0;

  private inboundSeqs = new Set<number>();

  private gA?: bigint;

  private gB?: bigint;

  private p?: bigint;

  private random?: bigint;

  private keyFingerprint?: string;

  private waitForState: Promise<void>;

  private resolveState?: VoidFunction;

  private isDestroyed = false;

  constructor(
    private isOutgoing: boolean,
    private shouldUseSctp = true,
  ) {
    this.waitForState = new Promise<void>((resolve) => {
      this.resolveState = resolve;
    });
  }

  destroy() {
    this.isDestroyed = true;
    this.resolveState?.();
    this.resolveState = undefined;
  }

  setShouldUseSctp(shouldUseSctp: boolean) {
    this.shouldUseSctp = shouldUseSctp;
  }

  async requestCall({ p, g, random }: DhConfig) {
    const primeBytes = Uint8Array.from(p);
    const pBN = validateDhParameters(primeBytes, g);
    const randomBN = generateDhPrivateExponent(pBN, random);

    const gA = modExp(BigInt(g), randomBN, pBN);
    validateDhPublicValue(gA, pBN, 'g_a');

    this.gA = gA;
    this.p = pBN;
    this.random = randomBN;

    const gAHash = await sha256(readBufferFromBigInt(gA, DH_PRIME_BYTES, false));
    return Array.from(gAHash);
  }

  acceptCall({ p, g, random }: DhConfig) {
    const primeBytes = Uint8Array.from(p);
    const pLast = validateDhParameters(primeBytes, g);
    const randomLast = generateDhPrivateExponent(pLast, random);

    const gB = modExp(BigInt(g), randomLast, pLast);
    validateDhPublicValue(gB, pLast, 'g_b');

    this.gB = gB;
    this.p = pLast;
    this.random = randomLast;

    return Array.from(readBufferFromBigInt(gB, DH_PRIME_BYTES, false));
  }

  async confirmCall({
    gAOrB,
    emojiData,
    emojiOffsets,
    gAHash,
    expectedKeyFingerprint,
  }: ConfirmCallParams) {
    if (!this.random || !this.p) {
      throw new Error('Values not set');
    }

    const peerValueBytes = Uint8Array.from(gAOrB);
    if (this.isOutgoing) {
      this.gB = readBigIntFromBuffer(peerValueBytes, false);
      validateDhPublicValue(this.gB, this.p, 'g_b');
    } else {
      if (!gAHash) {
        throw new SecurityError('Missing phone call gA hash');
      }

      if (expectedKeyFingerprint === undefined) {
        throw new SecurityError('Missing phone call key fingerprint');
      }

      await validateGAHash(peerValueBytes, gAHash);
      this.gA = readBigIntFromBuffer(peerValueBytes, false);
      validateDhPublicValue(this.gA, this.p, 'g_a');
    }
    const authKey = modExp(
      (!this.isOutgoing ? this.gA : this.gB)!,
      this.random,
      this.p,
    );
    const authKeyBytes = readBufferFromBigInt(authKey, DH_PRIME_BYTES, false);
    const fingerprint = await sha1(authKeyBytes);
    const keyFingerprint = readBigIntFromBuffer(fingerprint.slice(-8), true, true);
    const keyFingerprintString = keyFingerprint.toString();

    if (expectedKeyFingerprint !== undefined && keyFingerprintString !== expectedKeyFingerprint) {
      throw new SecurityError('Phone call key fingerprint mismatch');
    }

    const gABytes = readBufferFromBigInt(this.gA!, DH_PRIME_BYTES, false);
    const emojis = await generateEmojiFingerprint(
      authKeyBytes,
      gABytes,
      emojiData,
      emojiOffsets,
    );

    this.authKey = authKeyBytes;
    this.keyFingerprint = keyFingerprintString;
    this.resolveState?.();
    this.resolveState = undefined;

    return { gA: Array.from(gABytes), keyFingerprint: keyFingerprintString, emojis };
  }

  verifyKeyFingerprint({ expectedKeyFingerprint }: VerifyKeyFingerprintParams) {
    if (!this.keyFingerprint) {
      throw new SecurityError('Phone call key fingerprint is not set');
    }

    if (this.keyFingerprint !== expectedKeyFingerprint) {
      throw new SecurityError('Phone call key fingerprint mismatch');
    }
  }

  private async calcKey(msgKey: Uint8Array, isClient: boolean) {
    if (!this.authKey) {
      throw new Error('Auth key unset');
    }

    const x = 128 + (this.isOutgoing !== isClient ? 8 : 0);
    const [sha256a, sha256b] = await Promise.all([
      sha256(concat(msgKey, this.authKey.slice(x, x + 36))),
      sha256(concat(this.authKey.slice(x + 40, x + 76), msgKey)),
    ]);

    return {
      key: concat(sha256a.slice(0, 8), sha256b.slice(8, 24), sha256a.slice(24, 32)),
      iv: concat(sha256b.slice(0, 4), sha256a.slice(8, 16), sha256b.slice(24, 28)),
    };
  }

  async encode(data: unknown) {
    if (!this.authKey) return undefined;

    const message = gzipSync(bufferFromUtf8(JSON.stringify(data)));
    const packet = new Uint8Array(4 + message.length);
    writeUint32BE(packet, ++this.seq);
    packet.set(message, 4);

    const x = 128 + (this.isOutgoing ? 0 : 8);
    const msgKeyLarge = await sha256(concat(this.authKey.slice(88 + x, 88 + x + 32), packet));
    const msgKey = msgKeyLarge.slice(8, 24);
    const { key, iv } = await this.calcKey(msgKey, true);
    const encrypted = new CTR(key, iv).encrypt(packet);
    const body = concat(msgKey, encrypted);

    return this.shouldUseSctp ? this.sctp.wrapPayload(body) : Array.from(body);
  }

  async decode(data: number[]): Promise<any> {
    if (this.isDestroyed) {
      return undefined;
    }

    if (!this.authKey) {
      await this.waitForState;
      if (this.isDestroyed || !this.authKey) {
        return undefined;
      }
      return this.decode(data);
    }

    const incoming = Uint8Array.from(data);
    const payloads = isSctpPacket(incoming) ? this.sctp.receive(incoming) : [];
    const bodies = payloads.length ? payloads : [incoming];
    const messages = [];
    for (const body of bodies) {
      const message = await this.decodeBody(body);
      if (message) {
        messages.push(message);
      }
    }

    if (messages.length > 1) {
      return messages;
    }

    return messages[0];
  }

  private async decodeBody(body: Uint8Array): Promise<any> {
    if (body.length < 21) {
      return undefined;
    }
    const authKey = this.authKey;
    if (!authKey) {
      return undefined;
    }

    const msgKey = body.slice(0, 16);
    const encryptedData = body.slice(16);
    const { key, iv } = await this.calcKey(msgKey, false);
    const decrypted = new CTR(key, iv).decrypt(encryptedData);

    const x = 128 + (this.isOutgoing ? 8 : 0);
    const msgKeyLarge = await sha256(concat(authKey.slice(88 + x, 88 + x + 32), decrypted));
    if (!buffersEqual(msgKey, msgKeyLarge.slice(8, 24))) {
      return undefined;
    }

    if (decrypted.length < 4) {
      return undefined;
    }

    const inboundSeq = readUint32BE(decrypted);
    if (!this.shouldAcceptInboundSeq(inboundSeq)) {
      return undefined;
    }

    const message = decrypted.slice(4);
    try {
      const payload = message[0] === 0x1F && message[1] === 0x8B ? gunzipSync(message) : message;
      this.markInboundSeq(inboundSeq);
      return JSON.parse(bufferToUtf8(payload));
    } catch {
      return undefined;
    }
  }

  private shouldAcceptInboundSeq(seq: number) {
    return Boolean(seq && seq > this.maxInboundSeq - 64 && !this.inboundSeqs.has(seq));
  }

  private markInboundSeq(seq: number) {
    this.inboundSeqs.add(seq);
    if (seq > this.maxInboundSeq) {
      this.maxInboundSeq = seq;
    }

    const minSeq = this.maxInboundSeq - 64;
    this.inboundSeqs.forEach((item) => {
      if (item <= minSeq) {
        this.inboundSeqs.delete(item);
      }
    });
  }

  drainSignalingData() {
    if (!this.shouldUseSctp) {
      return [];
    }

    return this.sctp.drainPackets();
  }
}

// https://github.com/TelegramV/App/blob/ead52320975362139cabad18cf8346f98c349a22/src/js/MTProto/Calls/Internal.js#L72
function computeEmojiIndex(bytes: Uint8Array) {
  return ((BigInt(bytes[0]) & 0x7Fn) << 56n)
    | ((BigInt(bytes[1]) << 48n))
    | ((BigInt(bytes[2]) << 40n))
    | ((BigInt(bytes[3]) << 32n))
    | ((BigInt(bytes[4]) << 24n))
    | ((BigInt(bytes[5]) << 16n))
    | ((BigInt(bytes[6]) << 8n))
    | ((BigInt(bytes[7])));
}

async function generateEmojiFingerprint(
  authKey: Uint8Array, gA: Uint8Array, emojiData: Uint16Array, emojiOffsets: number[],
) {
  const hash = await sha256(concat(new Uint8Array(authKey), new Uint8Array(gA)));
  const result = [];
  const emojiCount = emojiOffsets.length - 1;
  const kPartSize = 8;
  for (let partOffset = 0; partOffset !== hash.byteLength; partOffset += kPartSize) {
    const value = computeEmojiIndex(hash.subarray(partOffset, partOffset + kPartSize));
    const index = Number(value % BigInt(emojiCount));
    const offset = emojiOffsets[index];
    const size = emojiOffsets[index + 1] - offset;
    result.push(String.fromCharCode(...emojiData.subarray(offset, offset + size)));
  }
  return result.join('');
}

async function validateGAHash(gA: Uint8Array, expectedHash: number[]) {
  if (expectedHash.length !== SHA256_HASH_BYTES) {
    throw new SecurityError('Invalid phone call gA hash');
  }

  const actualHash = await sha256(gA);
  if (!buffersEqual(actualHash, Uint8Array.from(expectedHash))) {
    throw new SecurityError('Phone call gA hash mismatch');
  }
}

export function createPhoneCallState({
  isOutgoing,
  shouldUseSctp = true,
}: {
  isOutgoing: boolean;
  shouldUseSctp?: boolean;
}) {
  currentPhoneCallState = new PhoneCallState(isOutgoing, shouldUseSctp);
}

export function setPhoneCallSctpEnabled(shouldUseSctp: boolean) {
  currentPhoneCallState?.setShouldUseSctp(shouldUseSctp);
}

export function destroyPhoneCallState() {
  currentPhoneCallState?.destroy();
  currentPhoneCallState = undefined;
}

type FunctionPropertyOf<T> = {
  [P in keyof T]: T[P] extends AnyFunction
    ? P
    : never
}[keyof T];

type ReturnTypeOf<T extends FunctionPropertyOf<PhoneCallState>> = ReturnType<PhoneCallState[T]>;

export function encodePhoneCallData({ data }: PhoneCallDataParams): ReturnTypeOf<'encode'> {
  return currentPhoneCallState!.encode(data);
}

export async function decodePhoneCallData({ data }: DecodePhoneCallDataParams) {
  if (!currentPhoneCallState) {
    return undefined;
  }
  const result = await currentPhoneCallState.decode(data);
  return result;
}

export function drainPhoneCallSignalingData() {
  return currentPhoneCallState?.drainSignalingData() || [];
}

export function confirmPhoneCall(params: ConfirmCallParams): ReturnTypeOf<'confirmCall'> {
  return currentPhoneCallState!.confirmCall(params);
}

export function verifyPhoneCallKeyFingerprint(
  params: VerifyKeyFingerprintParams,
): ReturnTypeOf<'verifyKeyFingerprint'> {
  return currentPhoneCallState!.verifyKeyFingerprint(params);
}

export function acceptPhoneCall(params: DhConfig): ReturnTypeOf<'acceptCall'> {
  return currentPhoneCallState!.acceptCall(params);
}

export function requestPhoneCall(params: DhConfig): ReturnTypeOf<'requestCall'> {
  return currentPhoneCallState!.requestCall(params);
}
