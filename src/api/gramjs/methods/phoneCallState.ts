import type bigInt from 'big-integer';
import BigInt from 'big-integer';
import AuthKey from '../../../lib/gramjs/crypto/AuthKey';
import Logger from '../../../lib/gramjs/extensions/Logger';
import Helpers from '../../../lib/gramjs/Helpers';
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

  private gA?: bigInt.BigInteger;

  private gB: any;

  private p?: bigInt.BigInteger;

  private random?: bigInt.BigInteger;

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
    const pBN = Helpers.readBigIntFromBuffer(Buffer.from(p), false);
    const randomBN = Helpers.readBigIntFromBuffer(Buffer.from(random), false);

    const gA = Helpers.modExp(BigInt(g), randomBN, pBN);

    this.gA = gA;
    this.p = pBN;
    this.random = randomBN;

    const gAHash: Buffer = await Helpers.sha256(Helpers.getByteArray(gA));
    return Array.from(gAHash);
  }

  acceptCall({ p, g, random }: DhConfig) {
    const pLast = Helpers.readBigIntFromBuffer(p, false);
    const randomLast = Helpers.readBigIntFromBuffer(random, false);

    const gB = Helpers.modExp(BigInt(g), randomLast, pLast);
    this.gB = gB;
    this.p = pLast;
    this.random = randomLast;

    return Array.from(Helpers.getByteArray(gB));
  }

  async confirmCall(gAOrB: number[], emojiData: Uint16Array, emojiOffsets: number[]) {
    if (this.isOutgoing) {
      this.gB = Helpers.readBigIntFromBuffer(Buffer.from(gAOrB), false);
    } else {
      this.gA = Helpers.readBigIntFromBuffer(Buffer.from(gAOrB), false);
    }
    const authKey = Helpers.modExp(
      !this.isOutgoing ? this.gA : this.gB,
      this.random,
      this.p,
    );
    const fingerprint: Buffer = await Helpers.sha1(Helpers.getByteArray(authKey));
    const keyFingerprint = Helpers.readBigIntFromBuffer(fingerprint.slice(-8).reverse(), false);

    const emojis = await generateEmojiFingerprint(
      Helpers.getByteArray(authKey),
      Helpers.getByteArray(this.gA),
      emojiData,
      emojiOffsets,
    );

    const key = new AuthKey();
    await key.setKey(Helpers.getByteArray(authKey));
    this.state = new MTProtoState(key, new Logger(), true, this.isOutgoing);
    this.resolveState!();

    return { gA: Array.from(Helpers.getByteArray(this.gA)), keyFingerprint: keyFingerprint.toString(), emojis };
  }

  async encode(data: string) {
    if (!this.state) return undefined;

    const seqArray = new Uint32Array(1);
    seqArray[0] = this.seq++;
    const encodedData = await this.state.encryptMessageData(
      Buffer.concat([Helpers.convertToLittle(seqArray), Buffer.from(data)]),
    );
    return Array.from(encodedData);
  }

  async decode(data: number[]): Promise<any> {
    if (!this.state) {
      return this.waitForState.then(() => {
        return this.decode(data);
      });
    }

    const message = await this.state.decryptMessageData(Buffer.from(data));

    return JSON.parse(message.toString());
  }
}

// https://github.com/TelegramV/App/blob/ead52320975362139cabad18cf8346f98c349a22/src/js/MTProto/Calls/Internal.js#L72
function computeEmojiIndex(bytes: Uint8Array) {
  return ((BigInt(bytes[0]).and(0x7F)).shiftLeft(56))
    .or((BigInt(bytes[1]).shiftLeft(48)))
    .or((BigInt(bytes[2]).shiftLeft(40)))
    .or((BigInt(bytes[3]).shiftLeft(32)))
    .or((BigInt(bytes[4]).shiftLeft(24)))
    .or((BigInt(bytes[5]).shiftLeft(16)))
    .or((BigInt(bytes[6]).shiftLeft(8)))
    .or((BigInt(bytes[7])));
}

export async function generateEmojiFingerprint(
  authKey: Uint8Array, gA: Uint8Array, emojiData: Uint16Array, emojiOffsets: number[],
) {
  const hash = await Helpers.sha256(Buffer.concat([new Uint8Array(authKey), new Uint8Array(gA)]));
  const result = [];
  const emojiCount = emojiOffsets.length - 1;
  const kPartSize = 8;
  for (let partOffset = 0; partOffset !== hash.byteLength; partOffset += kPartSize) {
    const value = computeEmojiIndex(hash.subarray(partOffset, partOffset + kPartSize));
    const index = value.modPow(1, emojiCount).toJSNumber();
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
  [P in keyof T]: T[P] extends Function
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
