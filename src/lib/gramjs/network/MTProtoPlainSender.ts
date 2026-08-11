/**
 *  This module contains the class used to communicate with Telegram's servers
 *  in plain text, when no authorization key has been created yet.
 */
import type { Logger } from '../extensions';
import type { Api } from '../tl';
import type { Connection } from './connection';

import { concat, writeInt32LE } from '../../../util/encoding/buffer';
import { BinaryReader } from '../extensions';

import { InvalidBufferError } from '../errors/Common';
import { toSignedLittleBuffer } from '../Helpers';
import MTProtoState from './MTProtoState';

const MAX_PLAIN_MESSAGE_BODY_LENGTH = 64 * 1024;
const PLAIN_MESSAGE_HEADER_LENGTH = 20;
const TL_ALIGNMENT = 4;

/**
 * MTProto Mobile Protocol plain sender (https://core.telegram.org/mtproto/description#unencrypted-messages)
 */

export default class MTProtoPlainSender {
  private _state: MTProtoState;

  private _connection: Connection;

  /**
     * Initializes the MTProto plain sender.
     * @param connection connection: the Connection to be used.
     * @param loggers
     */
  constructor(connection: Connection, loggers: Logger) {
    this._state = new MTProtoState(undefined, loggers);
    this._connection = connection;
  }

  /**
     * Sends and receives the result for the given request.
     * @param request
     */
  async send(request: Api.AnyRequest) {
    let body = request.getBytes();
    let msgId = this._state._getNewMsgId();
    const m = toSignedLittleBuffer(msgId, 8);
    const b = new Uint8Array(4);
    writeInt32LE(b, body.length);

    const res = concat(new Uint8Array(8), m, b, body);

    await this._connection.send(res);
    body = new Uint8Array(await this._connection.recv());
    if (
      body.length < PLAIN_MESSAGE_HEADER_LENGTH
      || body.length > PLAIN_MESSAGE_HEADER_LENGTH + MAX_PLAIN_MESSAGE_BODY_LENGTH
    ) {
      throw new InvalidBufferError(body);
    }
    const reader = new BinaryReader(body);
    const authKeyId = reader.readLong();
    if (authKeyId !== 0n) {
      throw new Error('Bad authKeyId');
    }
    msgId = reader.readLong();
    if (msgId === 0n) {
      throw new Error('Bad msgId');
    }
    /** ^ We should make sure that the read ``msg_id`` is greater
         * than our own ``msg_id``. However, under some circumstances
         * (bad system clock/working behind proxies) this seems to not
         * be the case, which would cause endless assertion errors.
         */

    const length = reader.readInt();
    // Plain auth responses must exactly match their declared aligned body
    // https://core.telegram.org/mtproto/description#unencrypted-messages
    if (
      length <= 0
      || length % TL_ALIGNMENT !== 0
      || length > MAX_PLAIN_MESSAGE_BODY_LENGTH
      || body.length !== PLAIN_MESSAGE_HEADER_LENGTH + length
    ) {
      throw new Error('Bad length');
    }

    const messageReader = new BinaryReader(reader.read(length));
    const response = messageReader.tgReadObject();
    if (messageReader.tellPosition() !== length) throw new Error('Bad length');

    return response;
  }
}
