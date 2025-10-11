import type { TLMessage } from '../tl/core';

import { RPCError, RPCMessageToError } from '../errors';
import {
  BinaryReader, type Logger, MessagePacker,
} from '../extensions';
import { Api } from '../tl';
import GZIPPacked from '../tl/core/GZIPPacked';
import RPCResult from '../tl/core/RPCResult';
import { type Connection, HttpConnection } from './connection';
import { UpdateConnectionState, UpdateServerTimeOffset } from './updates';

import { type Update } from '../client/TelegramClient';
import { AuthKey } from '../crypto/AuthKey';
import {
  BadMessageError, InvalidBufferError, SecurityError, TypeNotFoundError,
} from '../errors/Common';
import PendingState from '../extensions/PendingState';
import { jsonStringifyWithBigInt, sleep } from '../Helpers';
import MessageContainer from '../tl/core/MessageContainer';
import { doAuthentication } from './Authenticator';
import MtProtoPlainSender from './MTProtoPlainSender';
import MTProtoState from './MTProtoState';
import RequestState, { type CallableRequest } from './RequestState';

const LONGPOLL_MAX_WAIT = 3000;
const LONGPOLL_MAX_DELAY = 500;
const LONGPOLL_WAIT_AFTER = 150;

interface DefaultOptions {
  logger: Logger;
  retries: number;
  retriesToFallback: number;
  retryMainConnectionDelay: number;
  delay: number;
  dcId: number;
  senderIndex?: number;
  autoReconnect: boolean;
  shouldForceHttpTransport: boolean;
  shouldAllowHttpTransport: boolean;
  connectTimeout: number;
  authKeyCallback: any;
  updateCallback?: any;
  autoReconnectCallback?: any;
  isMainSender?: boolean;
  isExported?: boolean;
  senderCallback?: any;
  onConnectionBreak?: CallableFunction;
  getShouldDebugExportedSenders?: () => boolean;
}

/**
 * MTProto Mobile Protocol sender
 * (https://core.telegram.org/mtproto/description)
 * This class is responsible for wrapping requests into `TLMessage`'s,
 * sending them over the network and receiving them in a safe manner.
 *
 * Automatic reconnection due to temporary network issues is a concern
 * for this class as well, including retry of messages that could not
 * be sent successfully.
 *
 * A new authorization key will be generated on connection if no other
 * key exists yet.
 */
export default class MTProtoSender {
  static DEFAULT_OPTIONS: Partial<DefaultOptions> = {
    logger: undefined,
    retries: Infinity,
    retriesToFallback: 1,
    delay: 2000,
    retryMainConnectionDelay: 10000,
    shouldForceHttpTransport: false,
    shouldAllowHttpTransport: false,
    autoReconnect: true,
    connectTimeout: undefined,
    authKeyCallback: undefined,
    updateCallback: undefined,
    autoReconnectCallback: undefined,
    isMainSender: undefined,
    onConnectionBreak: undefined,
    isExported: undefined,
    getShouldDebugExportedSenders: undefined,
  };

  _connection?: Connection;

  _fallbackConnection?: Connection;

  private _shouldForceHttpTransport: boolean;

  private _shouldAllowHttpTransport: boolean;

  private _retriesToFallback: number;

  private readonly _log: Logger;

  _dcId: number;

  _senderIndex: number;

  private readonly _retries: number;

  private readonly _delay: number;

  private _retryMainConnectionDelay: number;

  private _isFallback: boolean;

  private readonly _authKeyCallback: any;

  public _updateCallback: (
    update: Update,
  ) => void;

  private readonly _autoReconnectCallback?: any;

  private readonly _isMainSender: boolean;

  private readonly _isExported: boolean;

  private _sendQueue: MessagePacker;

  private _sendQueueLongPoll: MessagePacker;

  private isSendingLongPoll?: boolean;

  private readonly _pendingAck: Set<any>;

  private readonly _lastAcks: any[];

  _pendingState: PendingState;

  _userConnected: boolean;

  isReconnecting: boolean;

  _disconnected: boolean;

  private _sendLoopHandle: any;

  private _recvLoopHandle: any;

  private _longPollLoopHandle: any;

  private _isReconnectingToMain = false;

  readonly authKey: AuthKey;

  private readonly _state: MTProtoState;

  _getShouldDebugExportedSenders?: () => boolean;

  private readonly _handlers: Record<number, (message: TLMessage) => void | Promise<void>>;

  private readonly _onConnectionBreak?: CallableFunction;

  userDisconnected: boolean;

  isConnecting = false;

  _authenticated = false;

  /**
   * @param authKey
   * @param opts
   */
  constructor(authKey: AuthKey, opts: DefaultOptions) {
    const args = { ...MTProtoSender.DEFAULT_OPTIONS, ...opts };
    this._connection = undefined;
    this._fallbackConnection = undefined;
    this._shouldForceHttpTransport = args.shouldForceHttpTransport;
    this._shouldAllowHttpTransport = args.shouldAllowHttpTransport;
    this._log = args.logger;
    this._dcId = args.dcId;
    this._senderIndex = args.senderIndex || 0;
    this._retries = args.retries;
    this._retriesToFallback = args.retriesToFallback;
    this._delay = args.delay;
    this._retryMainConnectionDelay = args.retryMainConnectionDelay;
    this._authKeyCallback = args.authKeyCallback;
    this._updateCallback = args.updateCallback;
    this._autoReconnectCallback = args.autoReconnectCallback;
    this._isMainSender = Boolean(args.isMainSender);
    this._isExported = Boolean(args.isExported);
    this._onConnectionBreak = args.onConnectionBreak;
    this._isFallback = false;
    this._getShouldDebugExportedSenders = args.getShouldDebugExportedSenders;

    /**
     * whether we disconnected ourself or telegram did it.
     */
    this.userDisconnected = false;

    /**
     * Whether the user has explicitly connected or disconnected.
     *
     * If a disconnection happens for any other reason and it
     * was *not* user action then the pending messages won't
     * be cleared but on explicit user disconnection all the
     * pending futures should be cancelled.
     */
    this._userConnected = false;
    this.isReconnecting = false;
    this._disconnected = true;

    /**
     * We need to join the loops upon disconnection
     */
    this._sendLoopHandle = undefined;
    this._longPollLoopHandle = undefined;
    this._recvLoopHandle = undefined;

    /**
     * Preserving the references of the AuthKey and state is important
     */
    this.authKey = authKey || new AuthKey();
    this._state = new MTProtoState(this.authKey, this._log);

    /**
     * Outgoing messages are put in a queue and sent in a batch.
     * Note that here we're also storing their ``_RequestState``.
     */
    this._sendQueue = new MessagePacker(this._state, this._log);
    this._sendQueueLongPoll = new MessagePacker(this._state, this._log);

    /**
     * Sent states are remembered until a response is received.
     */
    this._pendingState = new PendingState();

    /**
     * Responses must be acknowledged, and we can also batch these.
     */
    this._pendingAck = new Set();

    /**
     * Similar to pending_messages but only for the last acknowledges.
     * These can't go in pending_messages because no acknowledge for them
     * is received, but we may still need to resend their state on bad salts.
     */
    this._lastAcks = [];

    /**
     * Jump table from response ID to method that handles it
     */

    this._handlers = {
      [RPCResult.CONSTRUCTOR_ID]: this._handleRPCResult.bind(this),
      [MessageContainer.CONSTRUCTOR_ID]: this._handleContainer.bind(this),
      [GZIPPacked.CONSTRUCTOR_ID]: this._handleGzipPacked.bind(this),
      [Api.Pong.CONSTRUCTOR_ID]: this._handlePong.bind(this),
      [Api.BadServerSalt.CONSTRUCTOR_ID]: this._handleBadServerSalt.bind(this),
      [Api.BadMsgNotification.CONSTRUCTOR_ID]: this._handleBadNotification.bind(this),
      [Api.MsgDetailedInfo.CONSTRUCTOR_ID]: this._handleDetailedInfo.bind(this),
      [Api.MsgNewDetailedInfo.CONSTRUCTOR_ID]: this._handleNewDetailedInfo.bind(this),
      [Api.NewSessionCreated.CONSTRUCTOR_ID]: this._handleNewSessionCreated.bind(this),
      [Api.MsgsAck.CONSTRUCTOR_ID]: this._handleAck.bind(this),
      [Api.FutureSalts.CONSTRUCTOR_ID]: this._handleFutureSalts.bind(this),
      [Api.MsgsStateReq.CONSTRUCTOR_ID]: this._handleStateForgotten.bind(this),
      [Api.MsgResendReq.CONSTRUCTOR_ID]: this._handleStateForgotten.bind(this),
      [Api.MsgsAllInfo.CONSTRUCTOR_ID]: this._handleMsgAll.bind(this),
    };
  }

  // Public API

  logWithIndexCallback(level: 'debug' | 'log' | 'warn' | 'error') {
    return (...args: unknown[]) => {
      if (!this._getShouldDebugExportedSenders
        || !this._getShouldDebugExportedSenders()) return;
      // eslint-disable-next-line no-console
      console[level](`[${this._isExported ? `idx=${this._senderIndex} ` : 'M '}dcId=${this._dcId}]`, ...args);
    };
  }

  logWithIndex = {
    debug: this.logWithIndexCallback('debug'),
    log: this.logWithIndexCallback('log'),
    warn: this.logWithIndexCallback('warn'),
    error: this.logWithIndexCallback('error'),
  };

  getConnection(): Connection | undefined {
    return this._isFallback ? this._fallbackConnection : this._connection;
  }

  /**
   * Connects to the specified given connection using the given auth key.
   * @param connection
   * @param [force]
   * @param fallbackConnection
   * @returns {Promise<boolean>}
   */
  async connect(connection: Connection, force: boolean, fallbackConnection?: Connection) {
    this.userDisconnected = false;

    if (this._userConnected && !force) {
      this._log.info('User is already connected!');
      return false;
    }
    this.isConnecting = true;
    this._isFallback = this._shouldForceHttpTransport && this._shouldAllowHttpTransport;
    this._connection = connection;
    this._fallbackConnection = fallbackConnection;

    for (let attempt = 0; attempt < this._retries + this._retriesToFallback; attempt++) {
      try {
        if (attempt >= this._retriesToFallback && this._shouldAllowHttpTransport) {
          this._isFallback = true;
          this.logWithIndex.warn('Using fallback connection');
          this._log.warn('Using fallback connection');
        }
        this.logWithIndex.warn('Connecting...');
        await this._connect(this.getConnection()!);
        this.logWithIndex.warn('Connected!');
        if (!this._isExported) {
          this._updateCallback?.(new UpdateConnectionState(UpdateConnectionState.connected));
        }
        break;
      } catch (err) {
        if (!this._isExported && attempt === 0) {
          this._updateCallback?.(new UpdateConnectionState(UpdateConnectionState.disconnected));
        }
        this._log.error(`${this._isFallback ? 'HTTP' : 'WebSocket'} connection failed attempt: ${attempt + 1}`);
        // eslint-disable-next-line no-console
        console.error(err);
        await sleep(this._delay);
      }
    }
    this.isConnecting = false;

    if (this._isFallback && !this._shouldForceHttpTransport) {
      void this.tryReconnectToMain();
    }

    return true;
  }

  async tryReconnectToMain() {
    if (!this.isConnecting && this._isFallback && !this._isReconnectingToMain && !this.isReconnecting
      && !this._shouldForceHttpTransport && !this._isExported) {
      this._log.debug('Trying to reconnect to main connection');
      this._isReconnectingToMain = true;
      try {
        await this._connection!.connect();
        this._log.info('Reconnected to main connection');
        this.logWithIndex.warn('Reconnected to main connection');
        this.isReconnecting = true;
        if (this._fallbackConnection) this._disconnect(this._fallbackConnection);
        await this.connect(this._connection!, true, this._fallbackConnection);
        this.isReconnecting = false;
        this._isReconnectingToMain = false;
      } catch (e) {
        this.isReconnecting = false;
        this._isReconnectingToMain = false;
        this._log.error(
          `Failed to reconnect to main connection, retrying in ${this._retryMainConnectionDelay}ms`,
        );
        await sleep(this._retryMainConnectionDelay);
        void this.tryReconnectToMain();
      }
    } else {
      await sleep(this._retryMainConnectionDelay);
    }
  }

  isConnected() {
    return this._userConnected;
  }

  /**
   * Cleanly disconnects the instance from the network, cancels
   * all pending requests, and closes the send and receive loops.
   */
  disconnect() {
    this.userDisconnected = true;
    this.logWithIndex.warn('Disconnecting...');
    const connection = this.getConnection();
    if (!connection) return;
    this._disconnect(connection);
  }

  destroy() {
    this._sendQueue.clear();
  }

  /**
   *
   This method enqueues the given request to be sent. Its send
   state will be saved until a response arrives, and a ``Future``
   that will be resolved when the response arrives will be returned:

   .. code-block:: javascript

   async def method():
   # Sending (enqueued for the send loop)
   future = sender.send(request)
   # Receiving (waits for the receive loop to read the result)
   result = await future

   Designed like this because Telegram may send the response at
   any point, and it can send other items while one waits for it.
   Once the response for this future arrives, it is set with the
   received result, quite similar to how a ``receive()`` call
   would otherwise work.

   Since the receiving part is "built in" the future, it's
   impossible to await receive a result that was never sent.
   * @param request
   * @param abortSignal
   * @param isLongPoll
   * @returns {RequestState}
   */
  send<T extends CallableRequest>(request: T, abortSignal?: AbortSignal, isLongPoll = false) {
    const state = new RequestState<T>(request, abortSignal);
    if (!isLongPoll) {
      this.logWithIndex.debug(`Send ${request.className}`);
      this._sendQueue.append(state);
    } else {
      this._sendQueueLongPoll.append(state);
    }
    return state.promise;
  }

  addStateToQueue(state: RequestState) {
    this._sendQueue.append(state);
  }

  async sendBeacon(request: CallableRequest) {
    if (!this._userConnected || !(this._fallbackConnection instanceof HttpConnection)) {
      throw new Error('Cannot send requests while disconnected');
    }
    const state = new RequestState(request, undefined);
    const data = await this._sendQueue.getBeacon(state);
    if (!data) return;
    const encryptedData = await this._state.encryptMessageData(data);

    postMessage({
      type: 'sendBeacon',
      data: encryptedData,
      url: this._fallbackConnection.href,
    });
  }

  /**
   * Performs the actual connection, retrying, generating the
   * authorization key if necessary, and starting the send and
   * receive loops.
   * @returns {Promise<void>}
   * @private
   */
  async _connect(connection: Connection) {
    if (!connection.isConnected()) {
      this._log.info('Connecting to {0}...'.replace('{0}', connection._ip));
      await connection.connect();
      this._log.debug('Connection success!');
    }

    if (!this.authKey.getKey()) {
      const plain = new MtProtoPlainSender(connection, this._log);
      this._log.debug('New auth_key attempt ...');
      const res = await doAuthentication(plain, this._log);
      this._log.debug('Generated new auth_key successfully');
      await this.authKey.setKey(res.authKey);

      this._state.timeOffset = res.timeOffset;

      if (!this._isExported) {
        this._updateCallback?.(new UpdateServerTimeOffset(this._state.timeOffset));
      }

      /**
       * This is *EXTREMELY* important since we don't control
       * external references to the authorization key, we must
       * notify whenever we change it. This is crucial when we
       * switch to different data centers.
       */
      if (this._authKeyCallback) {
        await this._authKeyCallback(this.authKey, this._dcId);
      }
    } else {
      this._authenticated = true;
      this._log.debug('Already have an auth key ...');
    }
    this._userConnected = true;
    this.isReconnecting = false;

    if (!this._sendLoopHandle) {
      this._log.debug('Starting send loop');
      this._sendLoopHandle = this._sendLoop();
    }

    if (!this._recvLoopHandle) {
      this._log.debug('Starting receive loop');
      this._recvLoopHandle = this._recvLoop();
    }

    if (!this._longPollLoopHandle && connection.shouldLongPoll) {
      this._log.debug('Starting long-poll loop');
      this._longPollLoopHandle = this._longPollLoop();
    }

    // _disconnected only completes after manual disconnection
    // or errors after which the sender cannot continue such
    // as failing to reconnect or any unexpected error.

    this._log.info('Connection to %s complete!'.replace('%s', connection.toString()));
  }

  _disconnect(connection: Connection) {
    if (!this._isExported) {
      this._updateCallback?.(new UpdateConnectionState(UpdateConnectionState.disconnected));
    }

    if (connection === undefined) {
      this._log.info('Not disconnecting (already have no connection)');
      return;
    }

    this._log.info('Disconnecting from %s...'.replace('%s', connection.toString()));
    this._userConnected = false;
    this._log.debug('Closing current connection...');
    this.logWithIndex.warn('Disconnecting');
    connection.disconnect();
  }

  async _longPollLoop() {
    while (this._userConnected && !this.isReconnecting && this._isFallback
      && this.getConnection()!.shouldLongPoll) {
      await this._sendQueueLongPoll.wait();

      const res = await this._sendQueueLongPoll.get();

      if (this.isReconnecting || !this._isFallback) {
        this._longPollLoopHandle = undefined;
        return;
      }

      if (!res) {
        continue;
      }
      let { data } = res;
      const { batch } = res;
      this._log.debug(`Encrypting ${batch.length} message(s) in ${data.length} bytes for sending`);

      data = await this._state.encryptMessageData(data);

      try {
        await this._fallbackConnection?.send(data);
      } catch (e: any) {
        this._log.error(e);
        this._log.info('Connection closed while sending data');
        this._longPollLoopHandle = undefined;
        this.isSendingLongPoll = false;
        if (!this.userDisconnected) {
          this.reconnect();
        }
        return;
      }

      this.isSendingLongPoll = false;
      this.checkLongPoll();
    }

    this._longPollLoopHandle = undefined;
  }

  /**
   * This loop is responsible for popping items off the send
   * queue, encrypting them, and sending them over the network.
   * Besides `connect`, only this method ever sends data.
   * @returns {Promise<void>}
   * @private
   */
  async _sendLoop() {
    // Retry previous pending requests
    this._sendQueue.prepend(this._pendingState.values());
    this._pendingState.clear();

    while (this._userConnected && !this.isReconnecting) {
      const appendAcks = () => {
        if (this._pendingAck.size) {
          const ack = new RequestState(new Api.MsgsAck({ msgIds: Array(...this._pendingAck) }));
          this._sendQueue.append(ack);
          this._lastAcks.push(ack);
          if (this._lastAcks.length >= 10) {
            this._lastAcks.shift();
          }
          this._pendingAck.clear();
        }
      };

      appendAcks();

      this.logWithIndex.debug(`Waiting for messages to send... ${this.isReconnecting}`);
      this._log.debug(`Waiting for messages to send... ${this.isReconnecting}`);
      // TODO Wait for the connection send queue to be empty?
      // This means that while it's not empty we can wait for
      // more messages to be added to the send queue.
      await this._sendQueue.wait();

      if (this._isFallback) {
        // We don't long-poll on main loop, instead we have a separate loop for that
        this.send(new Api.HttpWait({
          maxDelay: 0,
          waitAfter: 0,
          maxWait: 0,
        }));
      }

      // If we've had new ACKs appended while waiting for messages to send, add them to queue
      appendAcks();

      const res = await this._sendQueue.get();

      this.logWithIndex.debug(`Got ${res?.batch.length} message(s) to send`);

      if (!res) {
        continue;
      }

      let { data } = res;
      const { batch } = res;

      for (const state of batch) {
        if (!Array.isArray(state)) {
          if (state.request.classType === 'request' && state.request.className !== 'HttpWait') {
            this._pendingState.set(state.msgId!, state);
          }
        } else {
          for (const s of state) {
            if (s.request.classType === 'request' && s.request.className !== 'HttpWait') {
              this._pendingState.set(s.msgId, s);
            }
          }
        }
      }

      if (this.isReconnecting) {
        this.logWithIndex.debug('Reconnecting :(');
        this._sendLoopHandle = undefined;
        return;
      }

      this._log.debug(`Encrypting ${batch.length} message(s) in ${data.length} bytes for sending`);
      this.logWithIndex.debug('Sending', batch.map((m) => m.request.className));

      data = await this._state.encryptMessageData(data);

      try {
        await this.getConnection()!.send(data);
      } catch (e: any) {
        this.logWithIndex.debug(`Connection closed while sending data ${e}`);
        this._log.error(e);
        this._log.info('Connection closed while sending data');
        this._sendLoopHandle = undefined;
        if (!this.userDisconnected) {
          this.reconnect();
        }
        return;
      } finally {
        for (const state of batch) {
          if (!Array.isArray(state)) {
            if (state.request.className === 'HttpWait') {
              state.resolve?.();
            }
          } else {
            for (const s of state) {
              if (s.request.className === 'HttpWait') {
                state.resolve?.();
              }
            }
          }
        }

        this.logWithIndex.debug('Encrypted messages put in a queue to be sent');
        this._log.debug('Encrypted messages put in a queue to be sent');
      }
    }

    this._sendLoopHandle = undefined;
  }

  async _recvLoop() {
    let body;
    let message;

    while (this._userConnected && !this.isReconnecting) {
      this._log.debug('Receiving items from the network...');
      this.logWithIndex.debug('Receiving items from the network...');
      try {
        body = await this.getConnection()!.recv();
      } catch (e: any) {
        // this._log.info('Connection closed while receiving data');
        /** when the server disconnects us we want to reconnect */
        if (!this.userDisconnected) {
          this._log.error(e);
          this._log.warn('Connection closed while receiving data');
          this.reconnect();
        }
        this._recvLoopHandle = undefined;
        return;
      }

      try {
        // TODO: Handle `DecryptedDataBlock` in calls like a regular `TLMessage` rather than `Buffer`
        message = (await this._state.decryptMessageData(body)) as TLMessage;
      } catch (e: any) {
        this.logWithIndex.debug(`Error while receiving items from the network ${e.toString()}`);
        if (e instanceof TypeNotFoundError) {
          // Received object which we don't know how to deserialize
          this._log.info(`Type ${e.invalidConstructorId} not found, remaining data ${e.remaining.length} bytes`);
          continue;
        } else if (e instanceof SecurityError) {
          // A step while decoding had the incorrect data. This message
          // should not be considered safe and it should be ignored.
          this._log.warn(`Security error while unpacking a received message: ${e.message}`);
          continue;
        } else if (e instanceof InvalidBufferError) {
          // 404 means that the server has "forgotten" our auth key and we need to create a new one.
          if (e.code === 404) {
            this._handleBadAuthKey();
          } else {
            // this happens sometimes when telegram is having some internal issues.
            // reconnecting should be enough usually
            // since the data we sent and received is probably wrong now.
            this._log.warn(`Invalid buffer ${e.code} for dc ${this._dcId}`);
            this.reconnect();
          }
          this._recvLoopHandle = undefined;
          return;
        } else {
          this._log.error('Unhandled error while receiving data');
          this._log.error(e);
          this.reconnect();
          this._recvLoopHandle = undefined;
          return;
        }
      }
      try {
        await this._processMessage(message);
      } catch (e: any) {
        // `RPCError` errors except for 'AUTH_KEY_UNREGISTERED' should be handled by the client
        if (e instanceof RPCError) {
          if (e.errorMessage === 'AUTH_KEY_UNREGISTERED'
            || e.errorMessage === 'SESSION_REVOKED'
            || e.errorMessage === 'USER_DEACTIVATED') {
            // 'AUTH_KEY_UNREGISTERED' for the main sender is thrown when unauthorized and should be ignored
            this._handleBadAuthKey(true);
          }
        } else {
          this._log.error('Unhandled error while receiving data');
          this._log.error(e);
        }
      }

      void this.checkLongPoll();
    }

    this._recvLoopHandle = undefined;
  }

  checkLongPoll() {
    if (this.isSendingLongPoll || !this._isFallback) return;

    this.isSendingLongPoll = true;
    this.send(new Api.HttpWait({
      maxDelay: LONGPOLL_MAX_DELAY,
      waitAfter: LONGPOLL_WAIT_AFTER,
      maxWait: LONGPOLL_MAX_WAIT,
    }), undefined, true);
  }

  _handleBadAuthKey(shouldSkipForMain?: boolean) {
    if (shouldSkipForMain && this._isMainSender) {
      return;
    }

    this._log.warn(`Broken authorization key for dc ${this._dcId}, resetting...`);

    if (this._isMainSender && !this._isExported) {
      this._updateCallback?.(new UpdateConnectionState(UpdateConnectionState.broken));
    } else if (!this._isMainSender && this._onConnectionBreak) {
      this._onConnectionBreak(this._dcId);
    }
  }

  // Response Handlers

  /**
   * Adds the given message to the list of messages that must be
   * acknowledged and dispatches control to different ``_handle_*``
   * method based on its type.
   * @param message
   * @returns {Promise<void>}
   * @private
   */
  async _processMessage(message: TLMessage) {
    if (message.obj.className === 'MsgsAck') return;
    this.logWithIndex.debug(`Process message ${message.obj.className}`);

    this._pendingAck.add(message.msgId);

    if (this.getConnection()!.shouldLongPoll) {
      this._sendQueue.setReady?.(true);
    }

    message.obj = await message.obj;
    let handler = this._handlers[message.obj.CONSTRUCTOR_ID];
    if (!handler) {
      handler = this._handleUpdate.bind(this);
    }

    await handler(message);
  }

  /**
   * Pops the states known to match the given ID from pending messages.
   * This method should be used when the response isn't specific.
   * @param msgId
   * @returns {*[]}
   * @private
   */
  _popStates(msgId: bigint) {
    const state = this._pendingState.getAndDelete(msgId);
    if (state) {
      return [state];
    }

    const toPop: bigint[] = [];

    for (const pendingState of this._pendingState.values()) {
      if (pendingState.containerId === msgId) {
        toPop.push(pendingState.msgId!);
      }
    }

    if (toPop.length) {
      const temp = [];
      for (const x of toPop) {
        temp.push(this._pendingState.getAndDelete(x));
      }
      return temp;
    }

    for (const ack of this._lastAcks) {
      if (ack.msgId === msgId) {
        return [ack];
      }
    }

    return [];
  }

  /**
   * Handles the result for Remote Procedure Calls:
   * rpc_result#f35c6d01 req_msg_id:long result:bytes = RpcResult;
   * This is where the future results for sent requests are set.
   * @param message
   * @returns {Promise<void>}
   * @private
   */
  _handleRPCResult(message: TLMessage) {
    const result = message.obj;
    const state = this._pendingState.getAndDelete(result.reqMsgId);
    this._log.debug(`Handling RPC result for message ${result.reqMsgId}`);

    if (!state) {
      // TODO We should not get responses to things we never sent
      // However receiving a File() with empty bytes is "common".
      // See #658, #759 and #958. They seem to happen in a container
      // which contain the real response right after.
      try {
        const reader = new BinaryReader(result.body);
        if (!(reader.tgReadObject() instanceof Api.upload.File)) {
          throw new TypeNotFoundError(0, Buffer.alloc(0));
        }
      } catch (e) {
        if (e instanceof TypeNotFoundError) {
          this._log.info(`Received response without parent request: ${result.body}`);
          return;
        } else if (this._isFallback) {
          // If we're using HTTP transport, there might be a chance that the response comes through
          // multiple times if didn't send acknowledgment in time, so we should just ignore it
          return;
        }

        throw e;
      }
      return;
    }

    if (result.error) {
      const error = RPCMessageToError(result.error, state.request);
      this._sendQueue.append(new RequestState(new Api.MsgsAck({ msgIds: [state.msgId!] })));
      state.reject?.(error);
      throw error;
    } else {
      try {
        const reader = new BinaryReader(result.body);
        const read = state.request.readResult(reader);
        this.logWithIndex.debug('Handling RPC result', read);
        state.resolve?.(read);
      } catch (err: any) {
        state.reject?.(err);
        throw err;
      }
    }
  }

  /**
   * Processes the inner messages of a container with many of them:
   * msg_container#73f1f8dc messages:vector<%Message> = MessageContainer;
   * @param message
   * @returns {Promise<void>}
   * @private
   */
  async _handleContainer(message: TLMessage) {
    this._log.debug('Handling container');
    for (const innerMessage of message.obj.messages) {
      await this._processMessage(innerMessage);
    }
  }

  /**
   * Unpacks the data from a gzipped object and processes it:
   * gzip_packed#3072cfa1 packed_data:bytes = Object;
   * @param message
   * @returns {Promise<void>}
   * @private
   */
  async _handleGzipPacked(message: TLMessage) {
    this._log.debug('Handling gzipped data');
    const reader = new BinaryReader(message.obj.data);
    message.obj = reader.tgReadObject();
    await this._processMessage(message);
  }

  _handleUpdate(message: TLMessage) {
    if (message.obj.SUBCLASS_OF_ID !== 0x8af52aac) {
      // crc32(b'Updates')
      this._log.warn(`Note: ${message.obj.className} is not an update, not dispatching it`);
      return;
    }
    this._log.debug(`Handling update ${message.obj.className}`);
    if (!this._isExported) {
      this._updateCallback?.(message.obj);
    }
  }

  /**
   * Handles pong results, which don't come inside a ``RPCResult``
   * but are still sent through a request:
   * pong#347773c5 msg_id:long ping_id:long = Pong;
   * @param message
   * @returns {Promise<void>}
   * @private
   */
  _handlePong(message: TLMessage) {
    const pong = message.obj;

    const newTimeOffset = this._state.updateTimeOffset(message.msgId);
    if (!this._isExported) {
      this._updateCallback?.(new UpdateServerTimeOffset(newTimeOffset));
    }

    this._log.debug(`Handling pong for message ${pong.msgId}`);
    const state = this._pendingState.getAndDelete(pong.msgId);

    // Todo Check result
    if (state) {
      state.resolve?.(pong);
    }
  }

  /**
   * Corrects the currently used server salt to use the right value
   * before enqueuing the rejected message to be re-sent:
   * bad_server_salt#edab447b bad_msg_id:long bad_msg_seqno:int
   * error_code:int new_server_salt:long = BadMsgNotification;
   * @param message
   * @returns {Promise<void>}
   * @private
   */
  _handleBadServerSalt(message: TLMessage) {
    const badSalt = message.obj;
    this._log.debug(`Handling bad salt for message ${badSalt.badMsgId}`);
    this._state.salt = badSalt.newServerSalt;
    const states = this._popStates(badSalt.badMsgId);
    this._sendQueue.extend(states);
    this._log.debug(`${states.length} message(s) will be resent`);
  }

  /**
   * Adjusts the current state to be correct based on the
   * received bad message notification whenever possible:
   * bad_msg_notification#a7eff811 bad_msg_id:long bad_msg_seqno:int
   * error_code:int = BadMsgNotification;
   * @param message
   * @returns {Promise<void>}
   * @private
   */
  _handleBadNotification(message: TLMessage) {
    const badMsg = message.obj;
    const states = this._popStates(badMsg.badMsgId);
    this._log.debug(`Handling bad msg ${jsonStringifyWithBigInt(badMsg)}`);
    if ([16, 17].includes(badMsg.errorCode)) {
      // Sent msg_id too low or too high (respectively).
      // Use the current msg_id to determine the right time offset.
      const newTimeOffset = this._state.updateTimeOffset(message.msgId);

      if (!this._isExported) {
        this._updateCallback?.(new UpdateServerTimeOffset(newTimeOffset));
      }

      this._log.info(`System clock is wrong, set time offset to ${newTimeOffset}s`);
    } else if (badMsg.errorCode === 32) {
      // msg_seqno too low, so just pump it up by some "large" amount
      // TODO A better fix would be to start with a new fresh session ID
      this._state._sequence += 64;
    } else if (badMsg.errorCode === 33) {
      // msg_seqno too high never seems to happen but just in case
      this._state._sequence -= 16;
    } else {
      for (const state of states) {
        state.reject(new BadMessageError(state.request, badMsg.errorCode));
      }

      return;
    }
    // Messages are to be re-sent once we've corrected the issue
    this._sendQueue.extend(states);
    this._log.debug(`${states.length} messages will be resent due to bad msg`);
  }

  /**
   * Updates the current status with the received detailed information:
   * msg_detailed_info#276d3ec6 msg_id:long answer_msg_id:long
   * bytes:int status:int = MsgDetailedInfo;
   * @param message
   * @returns {Promise<void>}
   * @private
   */
  _handleDetailedInfo(message: TLMessage) {
    // TODO https://goo.gl/VvpCC6
    const msgId = message.obj.answerMsgId;
    this._log.debug(`Handling detailed info for message ${msgId}`);
    this._pendingAck.add(msgId);
  }

  /**
   * Updates the current status with the received detailed information:
   * msg_new_detailed_info#809db6df answer_msg_id:long
   * bytes:int status:int = MsgDetailedInfo;
   * @param message
   * @returns {Promise<void>}
   * @private
   */
  _handleNewDetailedInfo(message: TLMessage) {
    // TODO https://goo.gl/VvpCC6
    const msgId = message.obj.answerMsgId;
    this._log.debug(`Handling new detailed info for message ${msgId}`);
    this._pendingAck.add(msgId);
  }

  /**
   * Updates the current status with the received session information:
   * new_session_created#9ec20908 first_msg_id:long unique_id:long
   * server_salt:long = NewSession;
   * @param message
   * @returns {Promise<void>}
   * @private
   */
  _handleNewSessionCreated(message: TLMessage) {
    // TODO https://goo.gl/LMyN7A
    this._log.debug('Handling new session created');
    this._state.salt = message.obj.serverSalt;
  }

  /**
   * Handles a server acknowledge about our messages. Normally these can be ignored
  */
  _handleAck() { }

  /**
   * Handles future salt results, which don't come inside a
   * ``rpc_result`` but are still sent through a request:
   *     future_salts#ae500895 req_msg_id:long now:int
   *     salts:vector<future_salt> = FutureSalts;
   * @param message
   * @returns {Promise<void>}
   * @private
   */
  _handleFutureSalts(message: TLMessage) {
    // TODO save these salts and automatically adjust to the
    // correct one whenever the salt in use expires.
    this._log.debug(`Handling future salts for message ${message.msgId.toString()}`);
    const state = this._pendingState.getAndDelete(message.msgId);

    if (state) {
      state.resolve?.(message.obj);
    }
  }

  /**
   * Handles both :tl:`MsgsStateReq` and :tl:`MsgResendReq` by
   * enqueuing a :tl:`MsgsStateInfo` to be sent at a later point.
   * @param message
   * @returns {Promise<void>}
   * @private
   */
  _handleStateForgotten(message: TLMessage) {
    this._sendQueue.append(
      new RequestState(
        new Api.MsgsStateInfo({
          reqMsgId: message.msgId,
          info: String.fromCharCode(1).repeat(message.obj.msgIds),
        }),
      ),
    );
  }

  /**
   * Handles :tl:`MsgsAllInfo` by doing nothing (yet).
   * used as part of the telegram protocol https://core.telegram.org/mtproto/service_messages_about_messages
   * This message does not require an acknowledgment.
   * @param message
   * @returns {Promise<void>}
   * @private
   */

  _handleMsgAll(message: TLMessage) {
  }

  reconnect() {
    if (this._userConnected && !this.isReconnecting) {
      this.isReconnecting = true;
      // TODO Should we set this?
      // this._user_connected = false
      // we want to wait a second between each reconnect try to not flood the server with reconnects
      // in case of internal server issues.
      sleep(1000)
        .then(() => {
          this.logWithIndex.log('Reconnecting...');
          this._log.info('Started reconnecting');
          this._reconnect();
        });
    }
  }

  async _reconnect() {
    const currentConnection = this._connection!;
    const currentFallbackConnection = this._fallbackConnection;
    this._log.debug('Closing current connection...');
    try {
      this.logWithIndex.warn('[Reconnect] Closing current connection...');
      if (currentConnection) this._disconnect(currentConnection);
      if (currentFallbackConnection) this._disconnect(currentFallbackConnection);
    } catch (err: any) {
      this._log.warn(err);
    }

    this._sendQueue.append(undefined);
    this._state.reset();

    // For some reason reusing existing connection caused stuck requests
    // @ts-expect-error -- Hacky way to create new class instance
    const newConnection = new currentConnection.constructor({
      ip: currentConnection._ip,
      port: currentConnection._port,
      dcId: currentConnection._dcId,
      loggers: currentConnection._log,
      isTestServer: currentConnection._isTestServer,
      isPremium: currentConnection._isPremium,
    });
    // @ts-expect-error -- Hacky way to create new class instance
    const newFallbackConnection = new this._fallbackConnection.constructor({
      ip: currentConnection._ip,
      port: currentConnection._port,
      dcId: currentConnection._dcId,
      loggers: currentConnection._log,
      isTestServer: currentConnection._isTestServer,
      isPremium: currentConnection._isPremium,
    });
    await this.connect(newConnection, true, newFallbackConnection);

    this.isReconnecting = false;
    this._sendQueue.prepend(this._pendingState.values());
    this._pendingState.clear();

    if (this._autoReconnectCallback) {
      await this._autoReconnectCallback();
    }
  }
}
