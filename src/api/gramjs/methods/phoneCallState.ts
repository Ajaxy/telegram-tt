import { gunzipSync, gzipSync } from 'fflate';
import { CTR } from '../../../lib/gramjs/crypto/CTR';
import {
  getByteArray, modExp, readBigIntFromBuffer, readBufferFromBigInt, sha1, sha256,
} from '../../../lib/gramjs/Helpers';

import { isSctpPacket, SctpSignaling } from './sctpSignaling';

type DhConfig = {
  p: number[];
  g: number;
  random: number[];
};

let currentPhoneCallState: PhoneCallState | undefined;

class PhoneCallState {
  private authKey?: Buffer;

  private sctp = new SctpSignaling();

  private seq = 0;

  private maxInboundSeq = 0;

  private inboundSeqs = new Set<number>();

  private gA?: bigint;

  private gB?: bigint;

  private p?: bigint;

  private random?: bigint;

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
    const pBN = readBigIntFromBuffer(Buffer.from(p), false);
    const randomBN = readBigIntFromBuffer(Buffer.from(random), false);

    const gA = modExp(BigInt(g), randomBN, pBN);

    this.gA = gA;
    this.p = pBN;
    this.random = randomBN;

    const gAHash: Buffer = await sha256(getByteArray(gA));
    return Array.from(gAHash);
  }

  acceptCall({ p, g, random }: DhConfig) {
    const pLast = readBigIntFromBuffer(Buffer.from(p), false);
    const randomLast = readBigIntFromBuffer(Buffer.from(random), false);

    const gB = modExp(BigInt(g), randomLast, pLast);
    this.gB = gB;
    this.p = pLast;
    this.random = randomLast;

    return Array.from(getByteArray(gB));
  }

  async confirmCall(gAOrB: number[], emojiData: Uint16Array, emojiOffsets: number[]) {
    if (!this.random || !this.p) {
      throw new Error('Values not set');
    }

    if (this.isOutgoing) {
      this.gB = readBigIntFromBuffer(Buffer.from(gAOrB), false);
    } else {
      this.gA = readBigIntFromBuffer(Buffer.from(gAOrB), false);
    }
    const authKey = modExp(
      (!this.isOutgoing ? this.gA : this.gB)!,
      this.random,
      this.p,
    );
    const fingerprint: Buffer = await sha1(getByteArray(authKey));
    const keyFingerprint = readBigIntFromBuffer(fingerprint.slice(-8), true, true);

    const emojis = await generateEmojiFingerprint(
      getByteArray(authKey),
      getByteArray(this.gA!),
      emojiData,
      emojiOffsets,
    );

    this.authKey = readBufferFromBigInt(authKey, 256, false);
    this.resolveState?.();
    this.resolveState = undefined;

    return { gA: Array.from(getByteArray(this.gA!)), keyFingerprint: keyFingerprint.toString(), emojis };
  }

  private async calcKey(msgKey: Buffer, isClient: boolean) {
    if (!this.authKey) {
      throw new Error('Auth key unset');
    }

    const x = 128 + (this.isOutgoing !== isClient ? 8 : 0);
    const [sha256a, sha256b] = await Promise.all([
      sha256(Buffer.concat([msgKey, this.authKey.slice(x, x + 36)])),
      sha256(Buffer.concat([this.authKey.slice(x + 40, x + 76), msgKey])),
    ]);

    return {
      key: Buffer.concat([sha256a.slice(0, 8), sha256b.slice(8, 24), sha256a.slice(24, 32)]),
      iv: Buffer.concat([sha256b.slice(0, 4), sha256a.slice(8, 16), sha256b.slice(24, 28)]),
    };
  }

  async encode(data: unknown) {
    if (!this.authKey) return undefined;

    const message = Buffer.from(gzipSync(Buffer.from(JSON.stringify(data))));
    const packet = Buffer.alloc(4 + message.length);
    packet.writeUInt32BE(++this.seq, 0);
    message.copy(packet, 4);

    const x = 128 + (this.isOutgoing ? 0 : 8);
    const msgKeyLarge = await sha256(Buffer.concat([this.authKey.slice(88 + x, 88 + x + 32), packet]));
    const msgKey = msgKeyLarge.slice(8, 24);
    const { key, iv } = await this.calcKey(msgKey, true);
    const encrypted = new CTR(key, iv).encrypt(packet);
    const body = Buffer.concat([msgKey, encrypted]);

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

    const incoming = Buffer.from(data);
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

  private async decodeBody(body: Buffer): Promise<any> {
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
    const msgKeyLarge = await sha256(Buffer.concat([authKey.slice(88 + x, 88 + x + 32), decrypted]));
    if (!msgKey.equals(msgKeyLarge.slice(8, 24))) {
      return undefined;
    }

    if (decrypted.length < 4) {
      return undefined;
    }

    const inboundSeq = decrypted.readUInt32BE(0);
    if (!this.shouldAcceptInboundSeq(inboundSeq)) {
      return undefined;
    }

    const message = decrypted.slice(4);
    try {
      const payload = message[0] === 0x1F && message[1] === 0x8B ? Buffer.from(gunzipSync(message)) : message;
      this.markInboundSeq(inboundSeq);
      return JSON.parse(payload.toString());
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
  const hash = await sha256(Buffer.concat([new Uint8Array(authKey), new Uint8Array(gA)]));
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

type ParamsOf<T extends FunctionPropertyOf<PhoneCallState>> = Parameters<PhoneCallState[T]>;
type ReturnTypeOf<T extends FunctionPropertyOf<PhoneCallState>> = ReturnType<PhoneCallState[T]>;

export function encodePhoneCallData(params: ParamsOf<'encode'>): ReturnTypeOf<'encode'> {
  return currentPhoneCallState!.encode(...params);
}

export async function decodePhoneCallData(params: ParamsOf<'decode'>) {
  if (!currentPhoneCallState) {
    return undefined;
  }
  const result = await currentPhoneCallState.decode(...params);
  return result;
}

export function drainPhoneCallSignalingData() {
  return currentPhoneCallState?.drainSignalingData() || [];
}

export function confirmPhoneCall(params: ParamsOf<'confirmCall'>): ReturnTypeOf<'confirmCall'> {
  return currentPhoneCallState!.confirmCall(...params);
}

export function acceptPhoneCall(params: ParamsOf<'acceptCall'>): ReturnTypeOf<'acceptCall'> {
  return currentPhoneCallState!.acceptCall(...params);
}

export function requestPhoneCall(params: ParamsOf<'requestCall'>): ReturnTypeOf<'requestCall'> {
  return currentPhoneCallState!.requestCall(...params);
}
