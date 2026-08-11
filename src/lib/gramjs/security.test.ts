import { describe, expect, it, vi } from 'vitest';

import { concat, writeInt32LE, writeUint32LE } from '../../util/encoding/buffer';
import { IGE } from './crypto/IGE';
import MTProtoState from './network/MTProtoState';
import GZIPPacked from './tl/core/GZIPPacked';
import { BinaryReader } from './extensions';

import { AuthKey } from './crypto/AuthKey';
import { Factorizator } from './crypto/Factorizator';
import { MessageReplayError, SecurityError } from './errors/Common';
import {
  readBufferFromBigInt,
  sha256,
  toSignedLittleBuffer,
  validateDhPublicValue,
} from './Helpers';
import MessageContainer from './tl/core/MessageContainer';

const AUTH_KEY_LENGTH = 256;
const MAX_GZIP_DATA_LENGTH = 64 * 1024 * 1024;
const MAX_CONTAINER_MESSAGES = 1024;
const MAX_ENCRYPTED_PADDING = 1024;
const DH_PRIME_BITS = 2048n;
const DH_PUBLIC_VALUE_SECURITY_BITS = 64n;
const DH_PUBLIC_VALUE_THRESHOLD = 1n << (DH_PRIME_BITS - DH_PUBLIC_VALUE_SECURITY_BITS);
const TEST_DH_MODULUS = (1n << DH_PRIME_BITS) - 159n;
const LARGE_P = 2147483629n;
const LARGE_Q = 2147483647n;
const LARGE_PQ = LARGE_P * LARGE_Q;
const TDLIB_SERVER_P = 179424611n;
const TDLIB_SERVER_Q = 179424673n;
const TDLIB_SERVER_PQ = TDLIB_SERVER_P * TDLIB_SERVER_Q;
const SERVER_SALT = 123n;
const SERVER_MSG_ID_PARITY = 1n;
const TEST_TIMESTAMP_SECONDS = 1_700_000_000;
const TRUE_CONSTRUCTOR = 0x997275b5;
const TRUE_BODY = encodeUint32(TRUE_CONSTRUCTOR);

type EncryptedPacketOptions = {
  msgId?: bigint;
  seqNo?: number;
  sessionId?: bigint;
  body?: Uint8Array;
  declaredBodyLength?: number;
  paddingLength?: number;
};

describe('TDLib-derived MTProto security checks', () => {
  // https://core.telegram.org/mtproto/auth_key#proof-of-work
  describe('factorization', () => {
    it('should factor a product of two distinct odd primes', () => {
      expect(Factorizator.factorize(323n)).toEqual({ p: 17n, q: 19n });
    });

    it('should factor a semiprime near the signed 63-bit limit', () => {
      expect(Factorizator.factorize(LARGE_PQ)).toEqual({ p: LARGE_P, q: LARGE_Q });
    });

    it('should factor TDLib server-sized primes', () => {
      expect(Factorizator.factorize(TDLIB_SERVER_PQ)).toEqual({
        p: TDLIB_SERVER_P,
        q: TDLIB_SERVER_Q,
      });
    });

    it.each([0n, 1n, 2n, 3n, 4n, 5n, 17n, 49n, 45n])('should reject invalid pq value %s', (pq) => {
      expect(() => Factorizator.factorize(pq)).toThrow(SecurityError);
    });
  });

  // https://core.telegram.org/mtproto/security_guidelines#g-a-and-g-b-validation
  describe('Diffie-Hellman public values', () => {
    it('should accept a value inside the safe range', () => {
      expect(() => validateDhPublicValue(
        DH_PUBLIC_VALUE_THRESHOLD + 1n,
        TEST_DH_MODULUS,
        'test',
      )).not.toThrow();
    });

    it.each([
      1n,
      DH_PUBLIC_VALUE_THRESHOLD,
      TEST_DH_MODULUS - DH_PUBLIC_VALUE_THRESHOLD,
      TEST_DH_MODULUS - 1n,
    ])('should reject unsafe public value %s', (publicValue) => {
      expect(() => validateDhPublicValue(publicValue, TEST_DH_MODULUS, 'test'))
        .toThrow(SecurityError);
    });
  });

  // https://core.telegram.org/api/invoking#decompressing-data
  describe('gzip payloads', () => {
    it('should decompress a valid bounded payload', () => {
      const input = Uint8Array.from([1, 2, 3, 4]);

      expect(GZIPPacked.ungzip(GZIPPacked.gzip(input))).toEqual(input);
    });

    it('should reject a payload without a complete gzip footer', () => {
      expect(() => GZIPPacked.ungzip(new Uint8Array(7)))
        .toThrow('Gzip payload is too short');
    });

    it('should reject a truncated valid gzip stream', () => {
      const gzip = GZIPPacked.gzip(TRUE_BODY);

      expect(() => GZIPPacked.ungzip(gzip.slice(0, -1))).toThrow();
    });

    it('should reject an advertised output larger than the limit', () => {
      const gzip = GZIPPacked.gzip(TRUE_BODY);
      writeUint32LE(gzip, MAX_GZIP_DATA_LENGTH + 1, gzip.length - 4);

      expect(() => GZIPPacked.ungzip(gzip))
        .toThrow('Unpacked gzip payload is too large');
    });

    it('should reject an output that does not match the advertised length', () => {
      const gzip = GZIPPacked.gzip(TRUE_BODY);
      writeUint32LE(gzip, TRUE_BODY.length + 4, gzip.length - 4);

      expect(() => GZIPPacked.ungzip(gzip))
        .toThrow('Unpacked gzip payload has an invalid length');
    });
  });

  // https://core.telegram.org/mtproto/service_messages#simple-container
  describe('message containers', () => {
    it.each([-1, MAX_CONTAINER_MESSAGES + 1])('should reject message count %s', async (messageCount) => {
      const reader = new BinaryReader(encodeInt32(messageCount));

      await expect(MessageContainer.fromReader(reader))
        .rejects.toThrow('Server sent an invalid message container count');
    });

    it('should reject a truncated inner message header', async () => {
      const reader = buildContainerReader(new Uint8Array(15));

      await expect(MessageContainer.fromReader(reader))
        .rejects.toThrow('Server sent a truncated inner message header');
    });

    it.each([-4, 5])('should reject inner message length %s', async (messageBodyLength) => {
      const message = buildInnerMessage(TRUE_BODY, messageBodyLength);
      const reader = buildContainerReader(message);

      await expect(MessageContainer.fromReader(reader))
        .rejects.toThrow('Server sent an invalid inner message length');
    });

    it('should reject an inner message length larger than the remaining payload', async () => {
      const message = buildInnerMessage(TRUE_BODY, TRUE_BODY.length * 2);
      const reader = buildContainerReader(message);

      await expect(MessageContainer.fromReader(reader))
        .rejects.toThrow('Server sent an invalid inner message length');
    });

    it('should reject nested message containers', async () => {
      const body = encodeUint32(MessageContainer.CONSTRUCTOR_ID);
      const reader = buildContainerReader(buildInnerMessage(body));

      await expect(MessageContainer.fromReader(reader))
        .rejects.toThrow('Server sent a nested message container');
    });

    it('should reject trailing inner message data', async () => {
      const body = concat(TRUE_BODY, new Uint8Array(4));
      const reader = buildContainerReader(buildInnerMessage(body));

      await expect(MessageContainer.fromReader(reader))
        .rejects.toThrow('Server sent trailing inner message body data');
    });

    it('should parse an exactly framed inner message', async () => {
      const reader = buildContainerReader(buildInnerMessage(TRUE_BODY));

      const container = await MessageContainer.fromReader(reader);

      expect(container.messages).toHaveLength(1);
      expect(container.messages[0].obj).toBe(true);
    });
  });

  // https://core.telegram.org/mtproto/description#encrypted-message-encrypted-data
  describe('encrypted transport packets', () => {
    it('should decrypt an authentic packet', async () => {
      const { authKey, authKeyBytes, state } = await createState();
      const packet = await buildEncryptedPacket(state, authKey, authKeyBytes);

      const message = await state.decryptMessageData(packet);

      expect(message.obj).toBe(true);
    });

    // https://core.telegram.org/mtproto/description#external-cryptographic-header
    it('should reject a mismatched authorization key ID', async () => {
      const { authKey, authKeyBytes, state } = await createState();
      const packet = await buildEncryptedPacket(state, authKey, authKeyBytes);
      packet[0] ^= 0x01;

      await expect(state.decryptMessageData(packet)).rejects.toThrow(SecurityError);
    });

    // https://core.telegram.org/mtproto/security_guidelines#checking-sha256-hash-value-of-msg-key
    it('should reject a mismatched message key', async () => {
      const { authKey, authKeyBytes, state } = await createState();
      const packet = await buildEncryptedPacket(state, authKey, authKeyBytes);
      packet[8] ^= 0x01;

      await expect(state.decryptMessageData(packet)).rejects.toThrow(SecurityError);
    });

    // https://core.telegram.org/mtproto/security_guidelines#checking-session-id
    it('should reject a packet for another session', async () => {
      const { authKey, authKeyBytes, state } = await createState();
      const packet = await buildEncryptedPacket(state, authKey, authKeyBytes, {
        sessionId: state['id'] + 1n,
      });

      await expect(state.decryptMessageData(packet)).rejects.toThrow(SecurityError);
    });

    // https://core.telegram.org/mtproto/security_guidelines#checking-message-length
    it.each([5, TRUE_BODY.length * 5])('should reject declared body length %s', async (declaredBodyLength) => {
      const { authKey, authKeyBytes, state } = await createState();
      const packet = await buildEncryptedPacket(state, authKey, authKeyBytes, {
        declaredBodyLength,
      });

      await expect(state.decryptMessageData(packet)).rejects.toThrow(SecurityError);
    });

    it('should reject padding shorter than 12 bytes', async () => {
      const { authKey, authKeyBytes, state } = await createState();
      const body = concat(TRUE_BODY, new Uint8Array(4));
      const packet = await buildEncryptedPacket(state, authKey, authKeyBytes, {
        body,
        paddingLength: 8,
      });

      await expect(state.decryptMessageData(packet)).rejects.toThrow(SecurityError);
    });

    it('should reject padding longer than 1024 bytes', async () => {
      const { authKey, authKeyBytes, state } = await createState();
      const packet = await buildEncryptedPacket(state, authKey, authKeyBytes, {
        paddingLength: MAX_ENCRYPTED_PADDING + 12,
      });

      await expect(state.decryptMessageData(packet)).rejects.toThrow(SecurityError);
    });

    // https://core.telegram.org/mtproto/security_guidelines#checking-msg-id
    it('should reject an even server message ID', async () => {
      const { authKey, authKeyBytes, state } = await createState();
      const packet = await buildEncryptedPacket(state, authKey, authKeyBytes, {
        msgId: buildMessageId(Math.floor(Date.now() / 1000), 0n),
      });

      await expect(state.decryptMessageData(packet)).rejects.toThrow(SecurityError);
    });

    it.each([-301, 31])('should reject a message with time offset %s seconds', async (timeOffset) => {
      vi.useFakeTimers();
      vi.setSystemTime(TEST_TIMESTAMP_SECONDS * 1000);
      try {
        const { authKey, authKeyBytes, state } = await createState();
        const packet = await buildEncryptedPacket(state, authKey, authKeyBytes, {
          msgId: buildMessageId(TEST_TIMESTAMP_SECONDS + timeOffset),
        });

        await expect(state.decryptMessageData(packet)).rejects.toThrow(SecurityError);
      } finally {
        vi.useRealTimers();
      }
    });

    it('should reject a replayed packet', async () => {
      const { authKey, authKeyBytes, state } = await createState();
      const packet = await buildEncryptedPacket(state, authKey, authKeyBytes);
      await state.decryptMessageData(packet);

      await expect(state.decryptMessageData(packet)).rejects.toThrow(MessageReplayError);
    });
  });
});

async function createState() {
  const authKeyBytes = Uint8Array.from({ length: AUTH_KEY_LENGTH }, (_, index) => index);
  const authKey = new AuthKey();
  await authKey.setKey(authKeyBytes);

  return {
    authKey,
    authKeyBytes,
    state: new MTProtoState(authKey),
  };
}

async function buildEncryptedPacket(
  state: MTProtoState,
  authKey: AuthKey,
  authKeyBytes: Uint8Array,
  options: EncryptedPacketOptions = {},
) {
  const body = options.body ?? TRUE_BODY;
  const msgId = options.msgId ?? buildMessageId(Math.floor(Date.now() / 1000));
  const seqNo = options.seqNo ?? 1;
  const sessionId = options.sessionId ?? state['id'];
  const declaredBodyLength = options.declaredBodyLength ?? body.length;
  const paddingLength = options.paddingLength ?? 12;
  const plaintext = concat(
    toSignedLittleBuffer(SERVER_SALT, 8),
    toSignedLittleBuffer(sessionId, 8),
    toSignedLittleBuffer(msgId, 8),
    encodeInt32(seqNo),
    encodeInt32(declaredBodyLength),
    body,
    new Uint8Array(paddingLength),
  );
  if (plaintext.length % 16 !== 0) {
    throw new Error('Test packet plaintext must be AES-aligned');
  }

  const msgKeyLarge = await sha256(concat(authKeyBytes.slice(96, 128), plaintext));
  const msgKey = msgKeyLarge.slice(8, 24);
  const { iv, key } = await state._calcKey(authKeyBytes, msgKey, false);
  const encryptedData = new IGE(key, iv).encryptIge(plaintext);

  return concat(
    readBufferFromBigInt(authKey.keyId!, 8),
    msgKey,
    encryptedData,
  );
}

function buildMessageId(timestamp: number, parity = SERVER_MSG_ID_PARITY) {
  return (BigInt(timestamp) << 32n) | parity;
}

function buildContainerReader(innerMessage: Uint8Array) {
  return new BinaryReader(concat(encodeInt32(1), innerMessage));
}

function buildInnerMessage(body: Uint8Array, declaredBodyLength = body.length) {
  return concat(
    toSignedLittleBuffer(buildMessageId(Math.floor(Date.now() / 1000)), 8),
    encodeInt32(1),
    encodeInt32(declaredBodyLength),
    body,
  );
}

function encodeInt32(value: number) {
  const buffer = new Uint8Array(4);
  writeInt32LE(buffer, value);
  return buffer;
}

function encodeUint32(value: number) {
  const buffer = new Uint8Array(4);
  writeUint32LE(buffer, value);
  return buffer;
}
