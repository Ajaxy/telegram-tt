/**
 *  This module contains the class used to communicate with Telegram's servers
 *  in plain text, when no authorization key has been created yet.
 */

import type { Logger } from '../extensions';
import type { Api } from '../tl';
import type { Connection } from './connection';

import { BinaryReader } from '../extensions';

import { InvalidBufferError } from '../errors/Common';
import { toSignedLittleBuffer } from '../Helpers';
import MTProtoState from './MTProtoState';

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
    const b = Buffer.alloc(4);
    b.writeInt32LE(body.length, 0);

    const res = Buffer.concat([Buffer.concat([Buffer.alloc(8), m, b]), body]);

    await this._connection.send(res);
    body = await this._connection.recv();
    if (body.length < 8) {
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
    if (length <= 0) {
      throw new Error('Bad length');
    }
    /**
         * We could read length bytes and use those in a new reader to read
         * the next TLObject without including the padding, but since the
         * reader isn't used for anything else after this, it's unnecessary.
         */
    return reader.tgReadObject();
  }
}
