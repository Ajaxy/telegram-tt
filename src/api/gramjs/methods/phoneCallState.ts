import { AuthKey } from '../../../lib/gramjs/crypto/AuthKey';
import { Logger } from '../../../lib/gramjs/extensions';
import {
  convertToLittle, getByteArray, modExp, readBigIntFromBuffer, sha1, sha256,
} from '../../../lib/gramjs/Helpers';
import MTProtoState from '../../../lib/gramjs/network/MTProtoState';

type DhConfig = {
  p: number[];
  g: number;
  random: number[];
};

let currentPhoneCallState: PhoneCallState | undefined;

class PhoneCallState {
  private state?: MTProtoState;

  private seq = 0;

  private gA?: bigint;

  private gB?: bigint;

  private p?: bigint;

  private random?: bigint;

  private waitForState: Promise<void>;

  private resolveState?: VoidFunction;

  constructor(
    private isOutgoing: boolean,
  ) {
    this.waitForState = new Promise<void>((resolve) => {
      this.resolveState = resolve;
    });
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
    const keyFingerprint = readBigIntFromBuffer(fingerprint.slice(-8).reverse(), false);

    const emojis = await generateEmojiFingerprint(
      getByteArray(authKey),
      getByteArray(this.gA!),
      emojiData,
      emojiOffsets,
    );

    const key = new AuthKey();
    await key.setKey(getByteArray(authKey));
    this.state = new MTProtoState(key, new Logger(), true, this.isOutgoing);
    this.resolveState!();

    return { gA: Array.from(getByteArray(this.gA!)), keyFingerprint: keyFingerprint.toString(), emojis };
  }

  async encode(data: string) {
    if (!this.state) return undefined;

    const seqArray = new Uint32Array(1);
    seqArray[0] = this.seq++;
    const encodedData = await this.state.encryptMessageData(
      Buffer.concat([convertToLittle(seqArray), Buffer.from(data)]),
    );
    return Array.from(encodedData);
  }

  async decode(data: number[]): Promise<any> {
    if (!this.state) {
      return this.waitForState.then(() => {
        return this.decode(data);
      });
    }

    const message = await this.state.decryptMessageData(Buffer.from(data)) as Buffer;

    return JSON.parse(message.toString());
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

export function createPhoneCallState(params: ConstructorParameters<typeof PhoneCallState>) {
  currentPhoneCallState = new PhoneCallState(...params);
}

export function destroyPhoneCallState() {
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

export function confirmPhoneCall(params: ParamsOf<'confirmCall'>): ReturnTypeOf<'confirmCall'> {
  return currentPhoneCallState!.confirmCall(...params);
}

export function acceptPhoneCall(params: ParamsOf<'acceptCall'>): ReturnTypeOf<'acceptCall'> {
  return currentPhoneCallState!.acceptCall(...params);
}

export function requestPhoneCall(params: ParamsOf<'requestCall'>): ReturnTypeOf<'requestCall'> {
  return currentPhoneCallState!.requestCall(...params);
}
