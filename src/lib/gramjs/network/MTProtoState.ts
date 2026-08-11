import type { AuthKey } from '../crypto/AuthKey';

import { compareBuffersConstantTime, concat, writeInt32LE } from '../../../util/encoding/buffer';
import { CTR } from '../crypto/CTR';
import { IGE } from '../crypto/IGE';
import { BinaryReader, type BinaryWriter, type Logger } from '../extensions';
import { Api } from '../tl';
import { TLMessage } from '../tl/core';
import GZIPPacked from '../tl/core/GZIPPacked';
import RPCResult from '../tl/core/RPCResult';

import { InvalidBufferError, MessageReplayError, SecurityError } from '../errors/Common';
import {
  generateRandomBytes,
  generateRandomLong,
  mod,
  readBigIntFromBuffer,
  readBufferFromBigInt,
  sha256,
  toSignedLittleBuffer,
} from '../Helpers';
import MessageContainer from '../tl/core/MessageContainer';
import {
  BAD_SERVER_SALT_ERROR_CODE,
  INVALID_TIME_ERROR_CODES,
  MAX_FUTURE_SERVER_SALTS,
} from './MTProtoConstants';

const REMOTE_MESSAGE_HISTORY_SIZE = 500;
const MAX_BUFFERED_REMOTE_MESSAGES = REMOTE_MESSAGE_HISTORY_SIZE * 2;
const MAX_INCOMING_MESSAGE_AGE = 300;
const MAX_INCOMING_MESSAGE_FUTURE_OFFSET = 30;
const ENCRYPTED_MESSAGE_EXTERNAL_HEADER_LENGTH = 24;
const ENCRYPTED_MESSAGE_HEADER_LENGTH = 32;
const MIN_ENCRYPTED_MESSAGE_PADDING = 12;
const MAX_ENCRYPTED_MESSAGE_PADDING = 1024;
const TL_ALIGNMENT = 4;
const SERVER_MSG_ID_PARITY = 1n;
const SERVER_SALT_VALIDITY_PERIOD = 1800;
const SERVER_SALT_GRACE_PERIOD = 1800;
const MAX_STORED_SERVER_SALTS = MAX_FUTURE_SERVER_SALTS + 1;
const MAX_MESSAGE_IDS = 8192;
const MESSAGE_STATE_UNKNOWN = 1;
const MESSAGE_STATE_NOT_RECEIVED = 2;
const MESSAGE_STATE_TOO_NEW = 3;
const MESSAGE_STATE_RECEIVED = 4;
const MESSAGE_STATE_ACKNOWLEDGED = 8;
const MESSAGE_STATE_NO_ACK_REQUIRED = 16;
const MESSAGE_ID_SCALE = 1n << 32n;
const MESSAGE_ID_ALIGNMENT = 4n;
const MESSAGE_ID_LOW_MASK = MESSAGE_ID_SCALE - 1n;
const MILLISECONDS_PER_SECOND = 1000n;
const MESSAGE_COPY_CONSTRUCTOR_ID = 0xe06046b2;
const FORBIDDEN_CONTENT_RELATED_CONSTRUCTOR_IDS = new Set([
  Api.MsgsAck.CONSTRUCTOR_ID,
  MessageContainer.CONSTRUCTOR_ID,
  MESSAGE_COPY_CONSTRUCTOR_ID,
]);

type CanSkipTimeValidation = (referencedMsgId: bigint, referencedMsgSeqNo?: number) => boolean;

type ServerSalt = {
  salt: bigint;
  validSince: number;
  validUntil: number;
};

type RemoteMessage = {
  isContentRelated: boolean;
  seqNo: number;
};

export default class MTProtoState {
  private readonly authKey?: AuthKey;

  private _log: any;

  timeOffset: number;

  private currentServerSalt?: bigint;

  private serverSalts: ServerSalt[];

  private id: bigint;

  _sequence: number;

  _isCall: boolean;

  _isOutgoing: boolean;

  private _lastMsgId: bigint;

  private remoteMsgIds: bigint[];

  private remoteMessages: Map<bigint, RemoteMessage>;

  private readonly replayedMessages = new WeakSet<TLMessage>();

  /**
   *
   `telethon.network.mtprotosender.MTProtoSender` needs to hold a state
   in order to be able to encrypt and decrypt incoming/outgoing messages,
   as well as generating the message IDs. Instances of this class hold
   together all the required information.

   It doesn't make sense to use `telethon.sessions.abstract.Session` for
   the sender because the sender should *not* be concerned about storing
   this information to disk, as one may create as many senders as they
   desire to any other data center, or some CDN. Using the same session
   for all these is not a good idea as each need their own authkey, and
   the concept of "copying" sessions with the unnecessary entities or
   updates state for these connections doesn't make sense.

   While it would be possible to have a `MTProtoPlainState` that does no
   encryption so that it was usable through the `MTProtoLayer` and thus
   avoid the need for a `MTProtoPlainSender`, the `MTProtoLayer` is more
   focused to efficiency and this state is also more advanced (since it
   supports gzipping and invoking after other message IDs). There are too
   many methods that would be needed to make it convenient to use for the
   authentication process, at which point the `MTProtoPlainSender` is better
   * @param authKey
   * @param loggers
   * @param isCall
   * @param isOutgoing
   */
  constructor(authKey?: AuthKey, loggers?: Logger, isCall = false, isOutgoing = false) {
    this.authKey = authKey;
    this._log = loggers;
    this._isCall = isCall;
    this._isOutgoing = isOutgoing;
    this.timeOffset = 0;
    this.serverSalts = [];

    this.id = 0n;
    this._sequence = 0;
    this._lastMsgId = 0n;
    this.remoteMsgIds = [];
    this.remoteMessages = new Map();
    this.reset();
  }

  /**
   * Resets the state
   */
  reset() {
    // Session IDs can be random on every connection
    this.id = generateRandomLong(true);
    this._sequence = 0;
    this._lastMsgId = 0n;
    this.remoteMsgIds = [];
    this.remoteMessages.clear();
  }

  getIncomingMessageState(msgId: bigint, isAcknowledged: boolean) {
    if ((msgId & 1n) !== SERVER_MSG_ID_PARITY) return MESSAGE_STATE_UNKNOWN;

    const remoteMessage = this.remoteMessages.get(msgId);
    if (remoteMessage) {
      // https://core.telegram.org/mtproto/service_messages_about_messages#informational-message-regarding-status-of-messages
      return MESSAGE_STATE_RECEIVED
        + (remoteMessage.isContentRelated
          ? (isAcknowledged ? MESSAGE_STATE_ACKNOWLEDGED : 0)
          : MESSAGE_STATE_NO_ACK_REQUIRED);
    }

    const retainedFloor = this.remoteMsgIds[0];
    if (retainedFloor === undefined || msgId < retainedFloor) return MESSAGE_STATE_UNKNOWN;
    if (msgId > this.remoteMsgIds[this.remoteMsgIds.length - 1]) return MESSAGE_STATE_TOO_NEW;

    return MESSAGE_STATE_NOT_RECEIVED;
  }

  setServerSalt(salt: bigint) {
    const serverTime = this.getServerTime();
    const previousSalt = this.currentServerSalt;
    const knownSalt = this.serverSalts.find((serverSalt) => (
      serverSalt.salt === salt
      && serverSalt.validSince <= serverTime
      && serverTime < serverSalt.validUntil + SERVER_SALT_GRACE_PERIOD
    ));
    if (previousSalt === salt && knownSalt) return;

    const retainedSalts = this.serverSalts.filter((serverSalt) => (
      serverSalt.validUntil + SERVER_SALT_GRACE_PERIOD > serverTime
      && serverSalt.salt !== salt
      && serverSalt.salt !== previousSalt
    ));
    if (previousSalt !== undefined && previousSalt !== salt) {
      const previousEntry = this.serverSalts.find(({ salt: storedSalt }) => (
        storedSalt === previousSalt
      ));
      retainedSalts.push({
        salt: previousSalt,
        validSince: previousEntry?.validSince ?? serverTime - SERVER_SALT_VALIDITY_PERIOD,
        validUntil: Math.min(previousEntry?.validUntil ?? serverTime, serverTime),
      });
    }

    this.currentServerSalt = salt;
    this.serverSalts = [
      ...retainedSalts,
      knownSalt && knownSalt.validUntil > serverTime ? knownSalt : {
        salt,
        validSince: serverTime,
        validUntil: serverTime + SERVER_SALT_VALIDITY_PERIOD,
      },
    ]
      .sort((firstSalt, secondSalt) => firstSalt.validSince - secondSalt.validSince)
      .slice(-MAX_STORED_SERVER_SALTS);
  }

  setFutureSalts(salts: readonly Api.TypeFutureSalt[]) {
    if (salts.length > MAX_FUTURE_SERVER_SALTS || salts.some(({ validSince, validUntil }) => (
      !Number.isInteger(validSince)
      || !Number.isInteger(validUntil)
      || validSince >= validUntil
    ))) {
      return false;
    }

    const serverTime = this.getServerTime();
    const futureSalts = salts
      .map(({ salt, validSince, validUntil }) => ({ salt, validSince, validUntil }))
      .sort((firstSalt, secondSalt) => firstSalt.validSince - secondSalt.validSince);
    const retainedSalts = this.serverSalts.filter(({ salt, validUntil }) => (
      validUntil + SERVER_SALT_GRACE_PERIOD > serverTime
      && !futureSalts.some(({ salt: futureSalt }) => futureSalt === salt)
      && (validUntil <= serverTime || salt === this.currentServerSalt)
    ));
    this.serverSalts = [...retainedSalts, ...futureSalts]
      .sort((firstSalt, secondSalt) => firstSalt.validSince - secondSalt.validSince)
      .slice(-MAX_STORED_SERVER_SALTS);

    this.selectServerSalt(serverTime);
    return true;
  }

  consumeMessageReplay(message: TLMessage) {
    return this.replayedMessages.delete(message);
  }

  /**
   * Updates the message ID to a new one,
   * used when the time offset changed.
   * @param message
   */
  updateMessageId(message: TLMessage) {
    message.msgId = this._getNewMsgId();
  }

  /**
   * Calculate the key based on Telegram guidelines, specifying whether it's the client or not
   */
  async _calcKey(
    authKey: Uint8Array, msgKey: Uint8Array, client: boolean,
  ): Promise<{ key: Uint8Array; iv: Uint8Array }> {
    const x = this._isCall
      ? (128 + (this._isOutgoing !== client ? 8 : 0))
      : (client ? 0 : 8);
    const [sha256a, sha256b] = await Promise.all([
      sha256(concat(msgKey, authKey.slice(x, x + 36))),
      sha256(concat(authKey.slice(x + 40, x + 76), msgKey)),
    ]);
    const key = concat(sha256a.slice(0, 8), sha256b.slice(8, 24), sha256a.slice(24, 32));
    if (this._isCall) {
      const iv = concat(sha256b.slice(0, 4), sha256a.slice(8, 16), sha256b.slice(24, 28));

      return {
        key,
        iv,
      };
    }
    const iv = concat(sha256b.slice(0, 8), sha256a.slice(8, 24), sha256b.slice(24, 32));
    return {
      key,
      iv,
    };
  }

  /**
   * Writes a message containing the given data into buffer.
   * Returns the message metadata.
   * @param buffer
   * @param data
   * @param contentRelated
   * @param afterId
   */
  writeDataAsMessage(
    buffer: BinaryWriter, data: Uint8Array, contentRelated: boolean, afterId?: bigint,
  ): { msgId: bigint; seqNo: number } {
    const msgId = this._getNewMsgId();
    const seqNo = this._getSeqNo(contentRelated);
    let body;
    if (afterId === undefined) {
      body = GZIPPacked.gzipIfNeeded(contentRelated, data);
    } else {
      // Invoke query expects a query with a getBytes func
      body = GZIPPacked.gzipIfNeeded(contentRelated, new Api.InvokeAfterMsg({
        msgId: afterId,
        query: {
          getBytes() {
            return data;
          },
        },
      }).getBytes());
    }
    const s = new Uint8Array(4);
    writeInt32LE(s, seqNo);
    const b = new Uint8Array(4);
    writeInt32LE(b, body.length);
    const m = toSignedLittleBuffer(msgId, 8);
    buffer.write(concat(m, s, b));
    buffer.write(body);
    return { msgId, seqNo };
  }

  /**
   * Encrypts the given message data using the current authorization key
   * following MTProto 2.0 guidelines core.telegram.org/mtproto/description.
   * @param data
   */
  async encryptMessageData(data: Uint8Array): Promise<Uint8Array> {
    if (!this.authKey) {
      throw new Error('Auth key unset');
    }

    await this.authKey.waitForKey();
    const authKey = this.authKey.getKey();
    if (!authKey) {
      throw new Error('Auth key unset');
    }

    if (this.authKey.keyId === undefined) {
      throw new Error('Unset params');
    }

    if (this._isCall) {
      const x = 128 + (this._isOutgoing ? 0 : 8);
      const lengthStart = data.length;

      data = new Uint8Array(data);
      if (lengthStart % 4 !== 0) {
        data = concat(data, new Uint8Array(4 - (lengthStart % 4)).fill(0x20));
      }

      const msgKeyLarge = await sha256(concat(authKey
        .slice(88 + x, 88 + x + 32), data));

      const msgKey = msgKeyLarge.slice(8, 24);

      const {
        iv,
        key,
      } = await this._calcKey(authKey, msgKey, true);

      data = new CTR(key, iv).encrypt(data);
      // data = data.slice(0, lengthStart)
      return concat(msgKey, data);
    } else {
      const s = toSignedLittleBuffer(this.getServerSalt(), 8);
      const i = toSignedLittleBuffer(this.id, 8);
      data = concat(s, i, data);
      const padding = generateRandomBytes(mod(-(data.length + 12), 16) + 12);
      // Being substr(what, offset, length); x = 0 for client
      // "msg_key_large = SHA256(substr(auth_key, 88+x, 32) + pt + padding)"
      const msgKeyLarge = await sha256(concat(authKey
        .slice(88, 88 + 32), data, padding));
      // "msg_key = substr (msg_key_large, 8, 16)"
      const msgKey = msgKeyLarge.slice(8, 24);

      const {
        iv,
        key,
      } = await this._calcKey(authKey, msgKey, true);

      const keyId = readBufferFromBigInt(this.authKey.keyId, 8);
      return concat(keyId, msgKey, new IGE(key, iv).encryptIge(concat(data, padding)));
    }
  }

  /**
   * Inverse of `encrypt_message_data` for incoming server messages.
   * @param body
   */
  async decryptMessageData(
    body: Uint8Array,
    canSkipTimeValidation?: CanSkipTimeValidation,
    canSkipInnerReplays?: boolean,
  ) {
    const receivedAt = Math.floor(Date.now() / 1000);

    if (!this.authKey) {
      throw new Error('Auth key unset');
    }

    if (this._isCall && body.length < 8) {
      throw new InvalidBufferError(body);
    }
    if (!this._isCall && body.length === 4) {
      const invalidBufferError = new InvalidBufferError(body);
      if (invalidBufferError.code === 404) throw invalidBufferError;
      throw new SecurityError();
    }
    if (!this._isCall && (body.length < ENCRYPTED_MESSAGE_EXTERNAL_HEADER_LENGTH
      || (body.length - ENCRYPTED_MESSAGE_EXTERNAL_HEADER_LENGTH) % 16 !== 0)) {
      throw new SecurityError();
    }
    let hasInvalidEncryptedPacket = false;
    if (!this._isCall) {
      const keyId = readBigIntFromBuffer(body.slice(0, 8));
      hasInvalidEncryptedPacket = keyId !== this.authKey.keyId;
    }
    const authKey = this.authKey.getKey();
    if (!authKey) {
      throw new SecurityError('Unset AuthKey');
    }
    const msgKey = this._isCall ? body.slice(0, 16) : body.slice(8, 24);

    const x = this._isCall ? 128 + (this._isOutgoing ? 8 : 0) : 0;
    const {
      iv,
      key,
    } = await this._calcKey(authKey, msgKey, false);

    if (this._isCall) {
      body = body.slice(16);
      const lengthStart = body.length;

      body = concat(body, new Uint8Array(4 - (lengthStart % 4)));

      body = new CTR(key, iv).decrypt(body);

      body = body.slice(0, lengthStart);
    } else {
      try {
        body = new IGE(key, iv).decryptIge(body.slice(ENCRYPTED_MESSAGE_EXTERNAL_HEADER_LENGTH));
      } catch {
        throw new SecurityError();
      }
    }

    const ourKey = this._isCall
      ? await sha256(concat(authKey
        .slice(88 + x, 88 + x + 32), body))
      : await sha256(concat(authKey
        .slice(96, 96 + 32), body));

    if (!this._isCall) {
      // https://core.telegram.org/mtproto/security_guidelines#checking-sha256-hash-value-of-msg-key
      // Complete the hash check even when an earlier packet check failed
      hasInvalidEncryptedPacket = !compareBuffersConstantTime(msgKey, ourKey.slice(8, 24))
        || hasInvalidEncryptedPacket;
    }
    if (!this._isCall && body.length < ENCRYPTED_MESSAGE_HEADER_LENGTH) {
      throw new SecurityError();
    }
    const reader = new BinaryReader(body);

    if (this._isCall) {
      // Seq
      reader.readInt(false);
      return reader.read(body.length - 4);
    } else {
      const serverSalt = reader.readLong();
      const serverId = reader.readLong();
      const hasInvalidServerSalt = !this.isServerSaltValid(serverSalt, receivedAt);
      hasInvalidEncryptedPacket = serverId !== this.id || hasInvalidEncryptedPacket;

      const remoteMsgId = reader.readLong();
      const remoteSequence = reader.readInt();
      const messageBodyLength = reader.readInt();
      const remainingPlaintextLength = body.length - ENCRYPTED_MESSAGE_HEADER_LENGTH;
      const paddingLength = remainingPlaintextLength - messageBodyLength;

      // https://core.telegram.org/mtproto/security_guidelines#checking-message-length
      if (messageBodyLength < 0 || messageBodyLength % TL_ALIGNMENT !== 0
        || messageBodyLength > remainingPlaintextLength
        || paddingLength < MIN_ENCRYPTED_MESSAGE_PADDING
        || paddingLength > MAX_ENCRYPTED_MESSAGE_PADDING) {
        hasInvalidEncryptedPacket = true;
      }

      if (hasInvalidEncryptedPacket) throw new SecurityError();

      const messageReader = reader.createSubReader(messageBodyLength);
      const obj = messageReader.tgReadObject();
      if (messageReader.tellPosition() !== messageBodyLength) {
        throw new SecurityError();
      }
      const message = new TLMessage(remoteMsgId, remoteSequence, obj);
      if (hasInvalidServerSalt
        && !this.canAcceptServerSalt(message, serverSalt, canSkipTimeValidation)) {
        throw new SecurityError();
      }
      this.validateIncomingMessages(
        message, receivedAt, canSkipTimeValidation, canSkipInnerReplays,
      );
      if (this.currentServerSalt === undefined || hasInvalidServerSalt) {
        this.setServerSalt(serverSalt);
      }

      return message;
    }
  }

  private validateIncomingMessages(
    message: TLMessage,
    receivedAt: number,
    canSkipTimeValidation?: CanSkipTimeValidation,
    canSkipInnerReplays?: boolean,
  ) {
    const incomingMessages: TLMessage[] = [];
    this.collectIncomingMessages(message, incomingMessages);
    const canSkipPacketTimeValidation = this.canSkipMessageTimeValidation(message, canSkipTimeValidation);
    const canSkipContainerReplays = canSkipInnerReplays && message.obj instanceof MessageContainer;

    const retainedFloor = this.remoteMsgIds[0];
    let previousIncomingMsgId: bigint | undefined;
    let areIncomingMessagesOrdered = true;
    let newMessageCount = 0;

    // https://core.telegram.org/mtproto/security_guidelines#checking-msg-id
    for (const incomingMessage of incomingMessages) {
      const { msgId, seqNo } = incomingMessage;

      if ((msgId & 1n) !== SERVER_MSG_ID_PARITY) {
        throw new SecurityError();
      }
      const isReplay = this.remoteMessages.has(msgId)
        || (retainedFloor !== undefined && msgId < retainedFloor);
      if (isReplay) {
        if (canSkipContainerReplays && incomingMessage !== message) {
          // HTTP may resend acknowledged messages alongside new container messages
          // https://core.telegram.org/mtproto/service_messages#simple-container
          this.replayedMessages.add(incomingMessage);
          continue;
        }
        throw new MessageReplayError();
      }
      if (seqNo < 0) {
        throw new SecurityError();
      }
      if (this.hasTooManyMessageIds(incomingMessage.obj)) {
        throw new SecurityError();
      }
      if (this.isMessageSequenceInvalid(incomingMessage)) {
        throw new SecurityError();
      }
      if (this.isMessageTimeInvalid(msgId, receivedAt) && !canSkipPacketTimeValidation) {
        throw new SecurityError();
      }

      if (previousIncomingMsgId !== undefined && previousIncomingMsgId >= msgId) {
        areIncomingMessagesOrdered = false;
      }
      previousIncomingMsgId = msgId;
      incomingMessages[newMessageCount++] = incomingMessage;
    }
    incomingMessages.length = newMessageCount;

    if (!areIncomingMessagesOrdered) {
      incomingMessages.sort(({ msgId: firstMsgId }, { msgId: secondMsgId }) => (
        firstMsgId < secondMsgId ? -1 : (firstMsgId > secondMsgId ? 1 : 0)
      ));
    }

    // https://core.telegram.org/mtproto/description#message-sequence-number-msg-seqno
    for (let index = 0; index < incomingMessages.length; index++) {
      const incomingMessage = incomingMessages[index];
      const previousIncomingMessage = incomingMessages[index - 1];
      if (previousIncomingMessage?.msgId === incomingMessage.msgId) {
        throw new SecurityError();
      }

      const insertionIndex = this.getRemoteMessageInsertionIndex(incomingMessage.msgId);
      const previousRemoteMsgId = this.remoteMsgIds[insertionIndex - 1];
      const nextRemoteMsgId = this.remoteMsgIds[insertionIndex];
      let previousSeqNo = previousRemoteMsgId === undefined
        ? undefined
        : this.remoteMessages.get(previousRemoteMsgId)!.seqNo;
      if (previousIncomingMessage
        && (previousRemoteMsgId === undefined || previousIncomingMessage.msgId > previousRemoteMsgId)) {
        previousSeqNo = previousIncomingMessage.seqNo;
      }
      const nextIncomingMessage = incomingMessages[index + 1];
      let nextSeqNo = nextRemoteMsgId === undefined
        ? undefined
        : this.remoteMessages.get(nextRemoteMsgId)!.seqNo;
      if (nextIncomingMessage
        && (nextRemoteMsgId === undefined || nextIncomingMessage.msgId < nextRemoteMsgId)) {
        nextSeqNo = nextIncomingMessage.seqNo;
      }
      const hasInvalidPreviousSequence = previousSeqNo !== undefined
        && this.isMessageSequenceOrderInvalid(previousSeqNo, incomingMessage.seqNo);
      const hasInvalidNextSequence = nextSeqNo !== undefined
        && this.isMessageSequenceOrderInvalid(incomingMessage.seqNo, nextSeqNo);
      if (hasInvalidPreviousSequence || hasInvalidNextSequence) {
        throw new SecurityError();
      }
    }

    this.rememberIncomingMessages(incomingMessages);
  }

  private getRemoteMessageInsertionIndex(msgId: bigint) {
    let startIndex = 0;
    let endIndex = this.remoteMsgIds.length;
    while (startIndex < endIndex) {
      const middleIndex = (startIndex + endIndex) >> 1;
      if (this.remoteMsgIds[middleIndex] < msgId) {
        startIndex = middleIndex + 1;
      } else {
        endIndex = middleIndex;
      }
    }
    return startIndex;
  }

  private isMessageSequenceOrderInvalid(previousSeqNo: number, nextSeqNo: number) {
    return previousSeqNo > nextSeqNo
      || (previousSeqNo === nextSeqNo && (previousSeqNo & 1) === 1);
  }

  private rememberIncomingMessages(incomingMessages: TLMessage[]) {
    const previousLength = this.remoteMsgIds.length;
    this.remoteMsgIds.length += incomingMessages.length;

    let previousIndex = previousLength - 1;
    let incomingIndex = incomingMessages.length - 1;
    let targetIndex = this.remoteMsgIds.length - 1;
    while (incomingIndex >= 0) {
      const incomingMsgId = incomingMessages[incomingIndex].msgId;
      if (previousIndex >= 0 && this.remoteMsgIds[previousIndex] > incomingMsgId) {
        this.remoteMsgIds[targetIndex--] = this.remoteMsgIds[previousIndex--];
      } else {
        this.remoteMsgIds[targetIndex--] = incomingMsgId;
        incomingIndex--;
      }
    }

    for (const incomingMessage of incomingMessages) {
      this.remoteMessages.set(incomingMessage.msgId, {
        isContentRelated: incomingMessage.isContentRelated,
        seqNo: incomingMessage.seqNo,
      });
    }

    if (this.remoteMsgIds.length <= MAX_BUFFERED_REMOTE_MESSAGES) return;

    const discardedCount = this.remoteMsgIds.length - REMOTE_MESSAGE_HISTORY_SIZE;

    for (let index = 0; index < discardedCount; index++) {
      this.remoteMessages.delete(this.remoteMsgIds[index]);
    }
    this.remoteMsgIds.copyWithin(0, discardedCount);
    this.remoteMsgIds.length = REMOTE_MESSAGE_HISTORY_SIZE;
  }

  private hasTooManyMessageIds(obj: unknown) {
    return (obj instanceof Api.MsgsAck
      || obj instanceof Api.MsgsStateReq
      || obj instanceof Api.MsgResendReq)
    && obj.msgIds.length > MAX_MESSAGE_IDS;
  }

  private isMessageSequenceInvalid(message: TLMessage) {
    // https://core.telegram.org/mtproto/service_messages#new-session-creation-notification
    if (message.obj.CONSTRUCTOR_ID === Api.NewSessionCreated.CONSTRUCTOR_ID) {
      return !message.isContentRelated;
    }

    // https://core.telegram.org/mtproto/description#content-related-message
    return message.isContentRelated
      && FORBIDDEN_CONTENT_RELATED_CONSTRUCTOR_IDS.has(message.obj.CONSTRUCTOR_ID);
  }

  private collectIncomingMessages(
    message: TLMessage,
    incomingMessages: TLMessage[],
    containerMsgId?: bigint,
  ) {
    this.unwrapGzipPacked(message);

    // https://core.telegram.org/mtproto/service_messages#simple-container
    if (containerMsgId !== undefined && message.msgId >= containerMsgId) {
      throw new SecurityError();
    }

    if (message.obj instanceof MessageContainer) {
      if (containerMsgId !== undefined) {
        throw new SecurityError();
      }

      for (const innerMessage of message.obj.messages) {
        this.collectIncomingMessages(innerMessage, incomingMessages, message.msgId);
      }
    }

    incomingMessages.push(message);
  }

  private unwrapGzipPacked(message: TLMessage) {
    while (message.obj instanceof GZIPPacked) {
      const { data } = message.obj;
      const reader = new BinaryReader(data);
      const obj = reader.tgReadObject();

      // https://core.telegram.org/api/invoking#decompressing-data
      if (obj instanceof MessageContainer || reader.tellPosition() !== data.length) {
        throw new SecurityError();
      }
      message.obj = obj;
    }
  }

  private isMessageTimeInvalid(msgId: bigint, receivedAt: number) {
    const remoteTime = Number(msgId >> 32n);
    const timeDelta = receivedAt + this.timeOffset - remoteTime;
    return timeDelta > MAX_INCOMING_MESSAGE_AGE
      || timeDelta < -MAX_INCOMING_MESSAGE_FUTURE_OFFSET;
  }

  private canSkipMessageTimeValidation(
    message: TLMessage,
    canSkipTimeValidation?: CanSkipTimeValidation,
  ): boolean {
    if (!canSkipTimeValidation) return false;
    if (message.obj instanceof MessageContainer) {
      return message.obj.messages.some((innerMessage) => (
        this.canSkipMessageTimeValidation(innerMessage, canSkipTimeValidation)
      ));
    }

    // https://core.telegram.org/mtproto/service_messages_about_messages#notice-of-ignored-error-message
    const {
      CONSTRUCTOR_ID: constructorId, badMsgId, badMsgSeqno, errorCode,
    } = message.obj;
    const isApplicableBadServerSalt = constructorId === Api.BadServerSalt.CONSTRUCTOR_ID
      && errorCode === BAD_SERVER_SALT_ERROR_CODE;
    const isApplicableBadMsg = constructorId === Api.BadMsgNotification.CONSTRUCTOR_ID
      && INVALID_TIME_ERROR_CODES.has(errorCode);
    if (!isApplicableBadServerSalt && !isApplicableBadMsg) return false;

    return canSkipTimeValidation(badMsgId, badMsgSeqno);
  }

  private getServerSalt() {
    this.selectServerSalt(this.getServerTime());
    return this.currentServerSalt ?? 0n;
  }

  private selectServerSalt(serverTime: number) {
    for (let i = this.serverSalts.length - 1; i >= 0; i--) {
      const serverSalt = this.serverSalts[i];
      if (serverSalt.validSince <= serverTime && serverTime < serverSalt.validUntil) {
        const previousSalt = this.currentServerSalt;
        if (previousSalt !== undefined && previousSalt !== serverSalt.salt) {
          const previousEntry = this.serverSalts.find(({ salt }) => salt === previousSalt);
          this.serverSalts = [
            ...this.serverSalts.filter(({ salt, validUntil }) => (
              validUntil + SERVER_SALT_GRACE_PERIOD > serverTime
              && salt !== previousSalt
            )),
            {
              salt: previousSalt,
              validSince: previousEntry?.validSince ?? serverTime - SERVER_SALT_VALIDITY_PERIOD,
              validUntil: Math.min(previousEntry?.validUntil ?? serverTime, serverTime),
            },
          ]
            .sort((firstSalt, secondSalt) => firstSalt.validSince - secondSalt.validSince)
            .slice(-MAX_STORED_SERVER_SALTS);
        }
        this.currentServerSalt = serverSalt.salt;
        return;
      }
    }
  }

  private isServerSaltValid(salt: bigint, receivedAt: number) {
    if (this.currentServerSalt === undefined) return true;

    const serverTime = receivedAt + this.timeOffset;
    // https://core.telegram.org/mtproto/description#server-salt
    return this.serverSalts.some((serverSalt) => (
      serverSalt.salt === salt
      && serverSalt.validSince <= serverTime
      && serverTime < serverSalt.validUntil + SERVER_SALT_GRACE_PERIOD
    ));
  }

  private canAcceptServerSalt(
    message: TLMessage,
    serverSalt: bigint,
    canSkipTimeValidation?: CanSkipTimeValidation,
  ) {
    const messages = message.obj instanceof MessageContainer ? message.obj.messages : [message];

    return messages.some((candidateMessage) => {
      const { obj } = candidateMessage;
      if (obj.CONSTRUCTOR_ID === Api.NewSessionCreated.CONSTRUCTOR_ID) {
        return obj.serverSalt === serverSalt;
      }

      if (obj.CONSTRUCTOR_ID === Api.BadServerSalt.CONSTRUCTOR_ID) {
        return obj.errorCode === BAD_SERVER_SALT_ERROR_CODE
          && obj.newServerSalt === serverSalt
          && canSkipTimeValidation?.(obj.badMsgId, obj.badMsgSeqno);
      }

      // https://core.telegram.org/mtproto/service_messages_about_messages#notice-of-ignored-error-message
      return obj.CONSTRUCTOR_ID === RPCResult.CONSTRUCTOR_ID
        && candidateMessage.isContentRelated
        && (candidateMessage.msgId & 3n) === 1n
        && canSkipTimeValidation?.(obj.reqMsgId);
    });
  }

  private getServerTime() {
    return Math.floor(Date.now() / 1000) + this.timeOffset;
  }

  /**
   * Generates a new unique message ID based on the current
   * time (in ms) since epoch, applying a known time offset.
   * @private
   */
  _getNewMsgId() {
    let newMsgId = this.getTimeBasedMessageId();
    if (this._lastMsgId >= newMsgId) {
      newMsgId = this._lastMsgId + MESSAGE_ID_ALIGNMENT;
    }
    if ((newMsgId & MESSAGE_ID_LOW_MASK) === 0n) newMsgId += MESSAGE_ID_ALIGNMENT;

    this._lastMsgId = newMsgId;
    return newMsgId;
  }

  /**
   * Updates the time offset to the correct
   * one given a known valid message ID.
   * @param correctMsgId {bigint}
   */
  updateTimeOffset(correctMsgId: bigint) {
    const bad = this.getTimeBasedMessageId();
    const old = this.timeOffset;
    let isSessionReset = false;
    const now = Math.floor(Date.now() / 1000);
    const correct = Number(correctMsgId >> 32n);
    this.timeOffset = correct - now;

    if (this.timeOffset !== old) {
      const nextMsgId = this._lastMsgId + MESSAGE_ID_ALIGNMENT;
      const latestAllowedMsgId = this.getTimeBasedMessageId()
        + BigInt(MAX_INCOMING_MESSAGE_FUTURE_OFFSET) * MESSAGE_ID_SCALE;

      // https://core.telegram.org/mtproto/description#message-identifier-msg-id
      // Keep monotonicity unless the corrected clock would make the next ID invalid
      if (this.timeOffset < old && nextMsgId > latestAllowedMsgId) {
        this.reset();
        isSessionReset = true;
      }

      this._log.debug(
        // eslint-disable-next-line @stylistic/max-len
        `Updated time offset (old offset ${old}, bad ${bad.toString()}, good ${correctMsgId.toString()}, new ${this.timeOffset})`,
      );
    }

    return { timeOffset: this.timeOffset, isSessionReset };
  }

  private getTimeBasedMessageId() {
    const timestampMilliseconds = BigInt(Date.now())
      + BigInt(this.timeOffset) * MILLISECONDS_PER_SECOND;
    const messageId = timestampMilliseconds * MESSAGE_ID_SCALE / MILLISECONDS_PER_SECOND;
    return messageId - messageId % MESSAGE_ID_ALIGNMENT;
  }

  /**
   * Generates the next sequence number depending on whether
   * it should be for a content-related query or not.
   * @param contentRelated
   * @private
   */
  _getSeqNo(contentRelated: boolean) {
    if (contentRelated) {
      const result = this._sequence * 2 + 1;
      this._sequence += 1;
      return result;
    } else {
      return this._sequence * 2;
    }
  }
}
