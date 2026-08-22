import type { TLMessage } from '../tl/core';

import { RPCError, RPCMessageToError } from '../errors';
import {
  BinaryReader, type Logger, MessagePacker,
} from '../extensions';
import { Api } from '../tl';
import GZIPPacked from '../tl/core/GZIPPacked';
import RPCResult from '../tl/core/RPCResult';
import { type Connection, HttpConnection } from './connection';
import { UpdateConnectionState, UpdateServerTimeOffset, UpdateSessionGap } from './updates';

import { type Update } from '../client/TelegramClient';
import { AuthKey } from '../crypto/AuthKey';
import {
  BadMessageError, InvalidBufferError, MessageReplayError, SecurityError, TypeNotFoundError,
} from '../errors/Common';
import PendingState from '../extensions/PendingState';
import { jsonStringifyWithBigInt, sleep } from '../Helpers';
import MessageContainer from '../tl/core/MessageContainer';
import { doAuthentication } from './Authenticator';
import {
  BAD_SERVER_SALT_ERROR_CODE,
  INVALID_TIME_ERROR_CODES,
  MAX_FUTURE_SERVER_SALTS,
} from './MTProtoConstants';
import MtProtoPlainSender from './MTProtoPlainSender';
import MTProtoState from './MTProtoState';
import RequestState, { type CallableRequest } from './RequestState';

const LONGPOLL_MAX_WAIT = 3000;
const LONGPOLL_MAX_DELAY = 500;
const LONGPOLL_WAIT_AFTER = 150;
const MAX_RECENT_SENT_MESSAGES = 500;
const RECENT_SENT_MESSAGE_TTL = 300000;
const BAD_MESSAGE_ERROR_CODES = new Set([16, 17, 18, 19, 20, 32, 33, 34, 35, 64]);
const MAX_MESSAGE_IDS = 8192;
const MAX_RECENT_ACKNOWLEDGED_MESSAGES = 500;
const MESSAGE_STATE_RECEIVED = 4;
const MESSAGE_STATE_NO_ACK_REQUIRED = 16;
const MESSAGE_STATE_RECEIVED_ELSEWHERE = 128;

type SentMessage = {
  msgId: bigint;
  seqNo: number;
  sentAt: number;
  state: RequestState;
  containerId?: bigint;
  containerSeqNo?: number;
};

type SentMessageReference = {
  message: SentMessage;
  isContainer: boolean;
};

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

  private _shouldUseFallbackOnReconnect: boolean;

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

  private readonly _pendingAck: Set<bigint>;

  private readonly _lastAcks: any[];

  private readonly _acknowledgedMsgIds: Set<bigint>;

  private readonly _recentSentMessages: Map<bigint, SentMessage>;

  private readonly _sentMessageIdsByState: Map<RequestState, bigint>;

  private readonly _sentMessageIdsByContainer: Map<bigint, Set<bigint>>;

  private _lastSessionFirstMsgId?: bigint;

  private _lastSessionUniqueId?: bigint;

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
    this._shouldUseFallbackOnReconnect = false;
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
    this._acknowledgedMsgIds = new Set();
    this._recentSentMessages = new Map();
    this._sentMessageIdsByState = new Map();
    this._sentMessageIdsByContainer = new Map();

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
      [Api.MsgsStateReq.CONSTRUCTOR_ID]: this._handleStateReq.bind(this),
      [Api.MsgResendReq.CONSTRUCTOR_ID]: this._handleResendReq.bind(this),
      [Api.MsgsStateInfo.CONSTRUCTOR_ID]: this._handleStateInfo.bind(this),
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
   * @param shouldUseFallback
   * @returns {Promise<boolean>}
   */
  async connect(
    connection: Connection,
    force: boolean,
    fallbackConnection?: Connection,
    shouldUseFallback?: boolean,
  ) {
    this.userDisconnected = false;

    if (this._userConnected && !force) {
      this._log.info('User is already connected!');
      return false;
    }
    this.isConnecting = true;
    this._isFallback = Boolean((this._shouldForceHttpTransport || shouldUseFallback)
      && this._shouldAllowHttpTransport);
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

    if (this._isFallback && !this._shouldForceHttpTransport && !shouldUseFallback) {
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
    const states = this._splitMessageIdRequest(request)
      .map((splitRequest) => new RequestState(splitRequest, abortSignal));
    for (let index = 1; index < states.length; index++) {
      void states[index].promise!.catch(() => undefined);
    }
    if (!isLongPoll) {
      this.logWithIndex.debug(`Send ${request.className}`);
      this._sendQueue.extend(states);
    } else {
      this._sendQueueLongPoll.extend(states);
    }
    return states[0].promise as RequestState<T>['promise'];
  }

  private _splitMessageIdRequest(request: CallableRequest) {
    if (!(request instanceof Api.MsgsAck
      || request instanceof Api.MsgsStateReq
      || request instanceof Api.MsgResendReq)
    || request.msgIds.length <= MAX_MESSAGE_IDS) return [request];

    const requests: CallableRequest[] = [];
    for (let index = 0; index < request.msgIds.length; index += MAX_MESSAGE_IDS) {
      const msgIds = request.msgIds.slice(index, index + MAX_MESSAGE_IDS);
      if (request instanceof Api.MsgsAck) {
        requests.push(new Api.MsgsAck({ msgIds }));
      } else if (request instanceof Api.MsgsStateReq) {
        requests.push(new Api.MsgsStateReq({ msgIds }));
      } else {
        requests.push(new Api.MsgResendReq({ msgIds }));
      }
    }

    return requests;
  }

  addStateToQueue(state: RequestState) {
    this._sendQueue.append(state);
  }

  async sendBeacon(request: CallableRequest) {
    if (!this._userConnected || !(this._fallbackConnection instanceof HttpConnection)) {
      throw new Error('Cannot send requests while disconnected');
    }
    const state = new RequestState(request, undefined);
    const data = this._sendQueue.getBeacon(state);
    if (!data) return;
    const encryptedData = await this._state.encryptMessageData(data);

    postMessage({
      payloads: [{
        type: 'sendBeacon',
        data: encryptedData,
        url: this._fallbackConnection.href,
      }],
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
    const wasReconnecting = this.isReconnecting;

    if (!connection.isConnected()) {
      this._log.info('Connecting to {0}...'.replace('{0}', connection._ip));
      await connection.connect();
      this._log.debug('Connection success!');
    }

    if (!this.authKey.getKey()) {
      const plain = new MtProtoPlainSender(connection, this._log);
      this._log.debug('New auth_key attempt ...');
      const res = await doAuthentication(plain, this._log, connection._dcId, connection._isTestServer);
      this._log.debug('Generated new auth_key successfully');
      await this.authKey.setKey(res.authKey);

      this._state.timeOffset = res.timeOffset;
      this._state.setServerSalt(res.serverSalt);

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
    } else if (wasReconnecting) {
      this.retryPendingStates();
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

      const res = this._sendQueueLongPoll.get();

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

      for (const state of batch) this._rememberSentMessage(state);

      data = await this._state.encryptMessageData(data);

      try {
        await this._fallbackConnection?.send(data);
      } catch (e: any) {
        this._log.info('Connection closed while sending data');
        // eslint-disable-next-line no-console
        console.error(e);
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
    this.retryPendingStates();

    while (this._userConnected && !this.isReconnecting) {
      const appendAcks = () => {
        if (this._pendingAck.size) {
          const msgIds = Array.from(this._pendingAck);
          this._pendingAck.clear();

          // https://core.telegram.org/mtproto/service_messages_about_messages#acknowledgment-of-receipt
          for (let index = 0; index < msgIds.length; index += MAX_MESSAGE_IDS) {
            const ack = new RequestState(new Api.MsgsAck({
              msgIds: msgIds.slice(index, index + MAX_MESSAGE_IDS),
            }));
            this._sendQueue.append(ack);
            this._lastAcks.push(ack);
            if (this._lastAcks.length >= 10) this._lastAcks.shift();
          }
        }
      };

      appendAcks();

      this.logWithIndex.debug(`Waiting for messages to send... ${this.isReconnecting}`);
      this._log.debug(`Waiting for messages to send... ${this.isReconnecting}`);
      // TODO Wait for the connection send queue to be empty?
      // This means that while it's not empty we can wait for
      // more messages to be added to the send queue.
      await this._sendQueue.wait();

      // If we've had new ACKs appended while waiting for messages to send, add them to queue
      appendAcks();

      const hasQueuedMessages = this._sendQueue.values().some(Boolean);
      if (!hasQueuedMessages) {
        // Consume explicit empty queue markers before waiting again
        this._sendQueue.get();
        continue;
      }

      if (this._isFallback) {
        // We don't long-poll on main loop, instead we have a separate loop for that
        this.send(new Api.HttpWait({
          maxDelay: 0,
          waitAfter: 0,
          maxWait: 0,
        }));
      }

      const res = this._sendQueue.get();

      this.logWithIndex.debug(`Got ${res?.batch.length} message(s) to send`);

      if (!res) {
        continue;
      }

      let { data } = res;
      const { batch } = res;

      for (const state of batch) {
        if (!Array.isArray(state)) {
          this._rememberSentMessage(state);
          if (this._shouldTrackPendingState(state)) {
            this._pendingState.set(state.msgId!, state);
          }
        } else {
          for (const s of state) {
            this._rememberSentMessage(s);
            if (this._shouldTrackPendingState(s)) {
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
      const connection = this.getConnection();

      data = await this._state.encryptMessageData(data);

      if (this.isReconnecting) {
        this.logWithIndex.debug('Reconnecting :(');
        this._sendLoopHandle = undefined;
        return;
      }

      if (!connection || connection !== this.getConnection()) {
        this.retryPendingStates();
        continue;
      }

      try {
        await connection.send(data);
        for (const state of batch) {
          if (Array.isArray(state)) {
            state.forEach(this._rememberSentAcknowledgments.bind(this));
          } else {
            this._rememberSentAcknowledgments(state);
          }
        }
      } catch (e: any) {
        this.logWithIndex.debug(`Connection closed while sending data ${e}`);
        this._log.info('Connection closed while sending data');
        // eslint-disable-next-line no-console
        console.error(e);
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
          this._log.warn('Connection closed while receiving data');
          // eslint-disable-next-line no-console
          console.error(e);
          this.reconnect();
        }
        this._recvLoopHandle = undefined;
        return;
      }

      try {
        // TODO: Handle `DecryptedDataBlock` in calls like a regular `TLMessage` rather than `Uint8Array`
        message = (await this._state.decryptMessageData(
          body, this._hasRecentSentMessage.bind(this),
          this._isFallback,
        )) as TLMessage;
      } catch (e: any) {
        this.logWithIndex.debug(`Error while receiving items from the network ${e.toString()}`);
        if (e instanceof MessageReplayError && this._isFallback) {
          continue;
        } else if (e instanceof TypeNotFoundError) {
          // Received object which we don't know how to deserialize
          this._log.info(`Type ${e.invalidConstructorId} not found, remaining data ${e.remaining.length} bytes`);
          continue;
        } else if (e instanceof SecurityError) {
          // https://core.telegram.org/mtproto/security_guidelines#behavior-in-case-of-mismatch
          this.handleSecurityError();
          this._recvLoopHandle = undefined;
          return;
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
          // eslint-disable-next-line no-console
          console.error(e);
          this.reconnect();
          this._recvLoopHandle = undefined;
          return;
        }
      }
      try {
        await this._processMessage(message);
      } catch (e: any) {
        // `RPCError` errors except for 'AUTH_KEY_UNREGISTERED' should be handled by the client
        if (e instanceof SecurityError) {
          this.handleSecurityError();
          this._recvLoopHandle = undefined;
          return;
        } else if (e instanceof RPCError) {
          if (e.errorMessage === 'AUTH_KEY_UNREGISTERED'
            || e.errorMessage === 'SESSION_REVOKED'
            || e.errorMessage === 'USER_DEACTIVATED') {
            // 'AUTH_KEY_UNREGISTERED' for the main sender is thrown when unauthorized and should be ignored
            this._handleBadAuthKey(true);
          }
        } else {
          this._log.error('Unhandled error while receiving data');
          // eslint-disable-next-line no-console
          console.error(e);
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
    this.logWithIndex.debug(`Process message ${message.obj.className}`);

    // https://core.telegram.org/mtproto/description#message-sequence-number-msg-seqno
    if (message.isContentRelated) this._pendingAck.add(message.msgId);

    if (this.getConnection()!.shouldLongPoll) {
      this._sendQueue.setReady?.(true);
    }

    if (this._state.consumeMessageReplay(message)) return;

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
    const states = state ? [state] : [];

    if (!state) {
      for (const pendingState of this._pendingState.values()) {
        if (pendingState.containerId === msgId) {
          states.push(this._pendingState.getAndDelete(pendingState.msgId!)!);
        }
      }
    }

    for (const ack of this._lastAcks) {
      if ((ack.msgId === msgId || ack.containerId === msgId) && !states.includes(ack)) {
        states.push(ack);
      }
    }

    return states;
  }

  private _hasRecentSentMessage(msgId: bigint, seqNo?: number) {
    const sentMessage = this._findSentMessage(msgId);
    return Boolean(sentMessage
      && (seqNo === undefined || this._getSentMessageSeqNo(sentMessage) === seqNo));
  }

  private _shouldTrackPendingState(state: RequestState) {
    return (state.request.classType === 'request' && state.request.className !== 'HttpWait')
      || state.request instanceof Api.MsgsStateReq;
  }

  private _rememberSentAcknowledgments(state: RequestState) {
    let msgIds: bigint[] | undefined;
    if (state.request instanceof Api.MsgsAck) {
      msgIds = state.request.msgIds;
    } else if (state.request instanceof Api.MsgsStateInfo) {
      msgIds = [state.request.reqMsgId];
      if (state.acknowledgedMsgIds) msgIds.push(...state.acknowledgedMsgIds);
    }
    if (!msgIds) return;

    for (const msgId of msgIds) this._acknowledgedMsgIds.add(msgId);
    while (this._acknowledgedMsgIds.size > MAX_RECENT_ACKNOWLEDGED_MESSAGES) {
      this._acknowledgedMsgIds.delete(this._acknowledgedMsgIds.values().next().value!);
    }
  }

  private _rememberSentMessage(state: RequestState) {
    this._forgetSentState(state);
    const message: SentMessage = {
      msgId: state.msgId!,
      seqNo: state.seqNo!,
      sentAt: Date.now(),
      state,
      containerId: state.containerId,
      containerSeqNo: state.containerSeqNo,
    };
    this._recentSentMessages.set(message.msgId, message);
    this._sentMessageIdsByState.set(state, message.msgId);
    if (message.containerId !== undefined) {
      let containerMessageIds = this._sentMessageIdsByContainer.get(message.containerId);
      if (!containerMessageIds) {
        containerMessageIds = new Set();
        this._sentMessageIdsByContainer.set(message.containerId, containerMessageIds);
      }
      containerMessageIds.add(message.msgId);
    }

    if (this._recentSentMessages.size > MAX_RECENT_SENT_MESSAGES) {
      const oldestMessage = this._recentSentMessages.values().next().value!;
      if (oldestMessage.containerId !== undefined) {
        this._forgetSentMessage(oldestMessage.containerId, true);
      } else {
        this._deleteSentMessage(oldestMessage.msgId);
      }
    }
  }

  private _findSentMessage(msgId: bigint): SentMessageReference | undefined {
    this._pruneRecentSentMessages();
    const message = this._recentSentMessages.get(msgId);
    if (message) return { message, isContainer: false };

    const sentMessageId = this._sentMessageIdsByContainer.get(msgId)?.values().next().value;
    const containerMessage = sentMessageId !== undefined
      ? this._recentSentMessages.get(sentMessageId)
      : undefined;
    if (!containerMessage) return undefined;

    return { message: containerMessage, isContainer: true };
  }

  private _pruneRecentSentMessages() {
    const expiredBefore = Date.now() - RECENT_SENT_MESSAGE_TTL;
    for (const [msgId, { sentAt }] of this._recentSentMessages) {
      if (sentAt < expiredBefore) this._deleteSentMessage(msgId);
    }
  }

  private _forgetSentMessage(msgId: bigint, isContainer: boolean) {
    if (!isContainer) {
      this._deleteSentMessage(msgId);
      return;
    }

    const sentMessageIds = this._sentMessageIdsByContainer.get(msgId);
    if (!sentMessageIds) return;

    for (const sentMsgId of sentMessageIds) {
      this._deleteSentMessage(sentMsgId);
    }
  }

  private _forgetSentState(state: RequestState) {
    const msgId = this._sentMessageIdsByState.get(state);
    if (msgId !== undefined) this._deleteSentMessage(msgId);
  }

  private _deleteSentMessage(msgId: bigint) {
    const sentMessage = this._recentSentMessages.get(msgId);
    if (!sentMessage) return;

    this._recentSentMessages.delete(msgId);
    if (this._sentMessageIdsByState.get(sentMessage.state) === msgId) {
      this._sentMessageIdsByState.delete(sentMessage.state);
    }

    const { containerId } = sentMessage;
    if (containerId === undefined) return;

    const sentMessageIds = this._sentMessageIdsByContainer.get(containerId);
    sentMessageIds?.delete(msgId);
    if (!sentMessageIds?.size) this._sentMessageIdsByContainer.delete(containerId);
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
          throw new TypeNotFoundError(0, new Uint8Array(0));
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

    this._forgetSentMessage(result.reqMsgId, false);

    if (result.error) {
      const error = RPCMessageToError(result.error, state.request);
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
    const { data } = message.obj;
    const reader = new BinaryReader(data);
    const obj = reader.tgReadObject();
    if (obj instanceof MessageContainer || reader.tellPosition() !== data.length) {
      throw new SecurityError();
    }
    message.obj = obj;
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
    const state = this._pendingState.get(pong.msgId);
    const isPing = state?.request instanceof Api.Ping
      || state?.request instanceof Api.PingDelayDisconnect;

    // https://core.telegram.org/mtproto/service_messages#ping-messages-ping-pong
    if (!state || !isPing || state.request.pingId !== pong.pingId) return;

    this._pendingState.delete(pong.msgId);
    this._deleteSentMessage(pong.msgId);

    const { timeOffset: newTimeOffset, isSessionReset } = this._state.updateTimeOffset(message.msgId);
    if (isSessionReset) this._resetSessionTracking();
    if (!this._isExported) {
      this._updateCallback?.(new UpdateServerTimeOffset(newTimeOffset));
    }

    this._log.debug(`Handling pong for message ${pong.msgId}`);
    state.resolve?.(pong);
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
    const sentMessage = this._findSentMessage(badSalt.badMsgId);
    if (badSalt.errorCode !== BAD_SERVER_SALT_ERROR_CODE
      || !sentMessage
      || this._getSentMessageSeqNo(sentMessage) !== badSalt.badMsgSeqno) return;

    // https://core.telegram.org/mtproto/service_messages_about_messages#notice-of-ignored-error-message
    this._forgetSentMessage(badSalt.badMsgId, sentMessage.isContainer);
    this._log.debug(`Handling bad salt for message ${badSalt.badMsgId}`);
    const states = this._popStates(badSalt.badMsgId);
    this._state.setServerSalt(badSalt.newServerSalt);
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
    const sentMessage = this._findSentMessage(badMsg.badMsgId);
    if (!sentMessage
      || !this._isBadNotificationApplicable(badMsg, message.msgId, sentMessage)) return;

    this._forgetSentMessage(badMsg.badMsgId, sentMessage.isContainer);
    const states = this._popStates(badMsg.badMsgId);
    this._log.debug(`Handling bad msg ${jsonStringifyWithBigInt(badMsg)}`);
    if (INVALID_TIME_ERROR_CODES.has(badMsg.errorCode)) {
      // Sent msg_id too low or too high (respectively).
      // Use the current msg_id to determine the right time offset.
      const { timeOffset: newTimeOffset, isSessionReset } = this._state.updateTimeOffset(message.msgId);
      if (isSessionReset) this._resetSessionTracking();

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
        state.reject?.(new BadMessageError(state.request, badMsg.errorCode));
      }

      return;
    }
    // Messages are to be re-sent once we've corrected the issue
    this._sendQueue.extend(states);
    this._log.debug(`${states.length} messages will be resent due to bad msg`);
  }

  private _isBadNotificationApplicable(
    badMsg: Api.BadMsgNotification,
    notificationMsgId: bigint,
    sentMessage: SentMessageReference,
  ) {
    const { errorCode, badMsgId, badMsgSeqno } = badMsg;
    const sentSeqNo = this._getSentMessageSeqNo(sentMessage);
    if (!BAD_MESSAGE_ERROR_CODES.has(errorCode) || sentSeqNo !== badMsgSeqno) return false;
    if (errorCode === 16) return badMsgId < notificationMsgId; // Message ID is too low
    if (errorCode === 17) return badMsgId > notificationMsgId; // Message ID is too high
    if (errorCode === 18) return (badMsgId & 3n) !== 0n; // Message ID has invalid low bits
    if (errorCode === 19 || errorCode === 64) return sentMessage.isContainer; // Duplicate ID or invalid container
    if (errorCode === 34) return (sentSeqNo & 1) === 1; // Even sequence number expected
    if (errorCode === 35) return (sentSeqNo & 1) === 0; // Odd sequence number expected

    return true;
  }

  private _getSentMessageSeqNo({ message, isContainer }: SentMessageReference) {
    return isContainer ? message.containerSeqNo! : message.seqNo;
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
    const { answerMsgId } = message.obj;
    this._pendingAck.add(answerMsgId);
    this._log.debug(`Handling detailed info for message ${answerMsgId}`);
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
    const { answerMsgId } = message.obj;
    this._pendingAck.add(answerMsgId);
    this._log.debug(`Handling new detailed info for message ${answerMsgId}`);
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
    const { firstMsgId, uniqueId, serverSalt } = message.obj;
    this._log.debug('Handling new session created');
    this._state.setServerSalt(serverSalt);

    if (firstMsgId === this._lastSessionFirstMsgId && uniqueId === this._lastSessionUniqueId) return;
    this._lastSessionFirstMsgId = firstMsgId;
    this._lastSessionUniqueId = uniqueId;

    // https://core.telegram.org/mtproto/service_messages#new-session-creation-notification
    if (!this._isExported) this._updateCallback?.(new UpdateSessionGap(firstMsgId, uniqueId));
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
    const futureSalts = message.obj;
    const state = this._pendingState.get(futureSalts.reqMsgId);

    // https://core.telegram.org/mtproto/service_messages#request-for-several-future-salts
    if (!(state?.request instanceof Api.GetFutureSalts)
      || state.request.num < 1
      || state.request.num > MAX_FUTURE_SERVER_SALTS
      || futureSalts.salts.length > state.request.num
      || !this._state.setFutureSalts(futureSalts.salts)) return;

    this._pendingState.delete(futureSalts.reqMsgId);
    this._forgetSentMessage(futureSalts.reqMsgId, false);
    this._log.debug(`Handling future salts for message ${futureSalts.reqMsgId.toString()}`);
    state.resolve?.(futureSalts);
  }

  _handleStateReq(message: TLMessage) {
    this._sendStateInfo(message.msgId, message.obj.msgIds);
  }

  _handleResendReq(message: TLMessage) {
    const states: RequestState[] = [];
    const knownStates = new Set<RequestState>();
    let hasUnknownMessages = false;

    for (const msgId of message.obj.msgIds) {
      if (!this._collectResendStates(msgId, states, knownStates)) {
        hasUnknownMessages = true;
      }
    }

    if (hasUnknownMessages) this._sendStateInfo(message.msgId, message.obj.msgIds);

    // https://core.telegram.org/mtproto/service_messages_about_messages#explicit-request-to-re-send-messages
    this._resendStates(states);
  }

  _handleStateInfo(message: TLMessage) {
    const stateInfo: Api.MsgsStateInfo = message.obj;
    const state = this._pendingState.get(stateInfo.reqMsgId);
    const statusCodes = stateInfo.info;
    if (!(state?.request instanceof Api.MsgsStateReq)
      || statusCodes.length !== state.request.msgIds.length
      || statusCodes.some((statusCode) => {
        const baseStatus = statusCode & 7;
        return baseStatus < 1 || baseStatus > 4;
      })) return;

    this._pendingState.delete(stateInfo.reqMsgId);
    this._forgetSentMessage(stateInfo.reqMsgId, false);

    const states: RequestState[] = [];
    const knownStates = new Set<RequestState>();
    statusCodes.forEach((statusCode, index) => {
      const baseStatus = statusCode & 7;
      if (baseStatus !== MESSAGE_STATE_RECEIVED
        && !(statusCode & MESSAGE_STATE_RECEIVED_ELSEWHERE)) {
        this._collectResendStates(state.request.msgIds[index], states, knownStates);
      }
    });
    // https://core.telegram.org/mtproto/service_messages_about_messages#informational-message-regarding-status-of-messages
    this._resendStates(states);
    state.resolve?.();
  }

  private _sendStateInfo(reqMsgId: bigint, msgIds: bigint[]) {
    const acknowledgedMsgIds: bigint[] = [];
    const info = Uint8Array.from(msgIds, (msgId) => {
      const status = this._state.getIncomingMessageState(
        msgId, this._acknowledgedMsgIds.has(msgId),
      );
      if ((status & 7) === MESSAGE_STATE_RECEIVED && !(status & MESSAGE_STATE_NO_ACK_REQUIRED)) {
        acknowledgedMsgIds.push(msgId);
      }
      return status;
    });
    const state = new RequestState(new Api.MsgsStateInfo({ reqMsgId, info }));
    state.acknowledgedMsgIds = acknowledgedMsgIds;
    this._sendQueue.append(state);
  }

  private _collectResendStates(
    msgId: bigint, states: RequestState[], knownStates: Set<RequestState>,
  ) {
    const sentMessage = (msgId & 3n) === 0n ? this._findSentMessage(msgId) : undefined;
    if (!sentMessage) return false;

    const messages = sentMessage.isContainer
      ? Array.from(this._sentMessageIdsByContainer.get(msgId) ?? [], (sentMsgId) => (
        this._recentSentMessages.get(sentMsgId)!
      ))
      : [sentMessage.message];
    for (const { state } of messages) {
      if (knownStates.has(state)) continue;
      knownStates.add(state);
      states.push(state);
    }
    return true;
  }

  private _resendStates(states: RequestState[]) {
    for (const state of states) {
      this._pendingState.delete(state.msgId!);
      this._forgetSentState(state);
    }
    this._sendQueue.extend(states);
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

  private handleSecurityError() {
    this._log.warn('Invalid encrypted packet');
    if (!this._isFallback && this._shouldAllowHttpTransport) {
      this._shouldUseFallbackOnReconnect = true;
    }
    this.reconnect();
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
    if (this.userDisconnected) {
      this.isReconnecting = false;
      this._shouldUseFallbackOnReconnect = false;
      return;
    }

    const shouldUseFallback = this._shouldUseFallbackOnReconnect;
    this._shouldUseFallbackOnReconnect = false;
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
    this._pendingAck.clear();
    this._acknowledgedMsgIds.clear();
    this._recentSentMessages.clear();
    this._sentMessageIdsByState.clear();
    this._sentMessageIdsByContainer.clear();
    this._lastAcks.length = 0;
    this._lastSessionFirstMsgId = undefined;
    this._lastSessionUniqueId = undefined;

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
    await this.connect(newConnection, true, newFallbackConnection, shouldUseFallback);

    this.isReconnecting = false;

    if (this._autoReconnectCallback) {
      await this._autoReconnectCallback();
    }
  }

  private retryPendingStates() {
    const pendingStates = this._pendingState.values();
    if (!pendingStates.length) return;

    this._sendQueue.prepend(pendingStates);
    this._pendingState.clear();
  }

  private _resetSessionTracking() {
    this.retryPendingStates();
    this._pendingAck.clear();
    this._acknowledgedMsgIds.clear();
    this._recentSentMessages.clear();
    this._sentMessageIdsByState.clear();
    this._sentMessageIdsByContainer.clear();
    this._lastAcks.length = 0;
    this._lastSessionFirstMsgId = undefined;
    this._lastSessionUniqueId = undefined;
  }
}
