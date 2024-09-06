import generateUniqueId from './generateUniqueId';
import { throttleWithTickEnd } from './schedulers';

export interface CancellableCallback {
  (
    ...args: any[]
  ): void;

  isCanceled?: boolean;
}

type InitPayload = {
  type: 'init';
  messageId?: string;
  args: any;
};

type CallMethodPayload = {
  type: 'callMethod';
  messageId?: string;
  name: string;
  args: any;
  withCallback?: boolean;
};

type CancelProgressPayload = {
  type: 'cancelProgress';
  messageId: string;
};

export type OriginPayload =
  InitPayload
  | CallMethodPayload
  | CancelProgressPayload;

export type OriginMessageData = {
  channel?: string;
  payloads: OriginPayload[];
};

export interface OriginMessageEvent {
  data: OriginMessageData;
}

export type ApiUpdate =
  { type: string }
  & any;

export type WorkerPayload =
  {
    channel?: string;
    type: 'update';
    update: ApiUpdate;
  }
  |
  {
    channel?: string;
    type: 'methodResponse';
    messageId: string;
    response?: any;
    error?: { message: string };
  }
  |
  {
    channel?: string;
    type: 'methodCallback';
    messageId: string;
    callbackArgs: any[];
  }
  |
  {
    channel?: string;
    type: 'unhandledError';
    error?: { message: string };
  };

export type WorkerMessageData = {
  channel?: string;
  payloads: WorkerPayload[];
};

export interface WorkerMessageEvent {
  data: WorkerMessageData;
}

interface RequestState {
  messageId: string;
  resolve: Function;
  reject: Function;
  callback: AnyToVoidFunction;
}

type InputRequestTypes = Record<string, AnyFunction>;

type Values<T> = T[keyof T];
export type RequestTypes<T extends InputRequestTypes> = Values<{
  [Name in keyof (T)]: {
    name: Name & string;
    args: Parameters<T[Name]>;
    transferables?: Transferable[];
  }
}>;

class ConnectorClass<T extends InputRequestTypes> {
  private requestStates = new Map<string, RequestState>();

  private requestStatesByCallback = new Map<AnyToVoidFunction, RequestState>();

  private pendingPayloads: OriginPayload[] = [];

  private pendingTransferables: Transferable[] = [];

  constructor(
    public target: Worker,
    private onUpdate?: (update: ApiUpdate) => void,
    private channel?: string,
  ) {
  }

  // eslint-disable-next-line class-methods-use-this
  public destroy() {
  }

  init(...args: any[]) {
    this.postMessageOnTickEnd({
      type: 'init',
      args,
    });
  }

  request(messageData: RequestTypes<T>) {
    const { requestStates, requestStatesByCallback } = this;
    const { transferables, ...restMessageData } = messageData;

    const messageId = generateUniqueId();
    const payload: CallMethodPayload = {
      type: 'callMethod',
      messageId,
      ...restMessageData,
    };

    const requestState = { messageId } as RequestState;

    // Re-wrap type because of `postMessage`
    const promise: Promise<any> = new Promise((resolve, reject) => {
      Object.assign(requestState, { resolve, reject });
    });

    if (typeof payload.args[payload.args.length - 1] === 'function') {
      payload.withCallback = true;

      const callback = payload.args.pop() as AnyToVoidFunction;
      requestState.callback = callback;
      requestStatesByCallback.set(callback, requestState);
    }

    requestStates.set(messageId, requestState);
    promise
      .catch(() => undefined)
      .finally(() => {
        requestStates.delete(messageId);

        if (requestState.callback) {
          requestStatesByCallback.delete(requestState.callback);
        }
      });

    this.postMessageOnTickEnd(payload, transferables);

    return promise;
  }

  cancelCallback(progressCallback: CancellableCallback) {
    progressCallback.isCanceled = true;

    const { messageId } = this.requestStatesByCallback.get(progressCallback) || {};
    if (!messageId) {
      return;
    }

    this.postMessageOnTickEnd({
      type: 'cancelProgress',
      messageId,
    });
  }

  onMessage(data: WorkerMessageData) {
    const { requestStates, channel } = this;
    if (data.channel !== channel) {
      return;
    }

    data.payloads.forEach((payload) => {
      if (payload.type === 'update' && this.onUpdate) {
        this.onUpdate(payload.update);
      }
      if (payload.type === 'methodResponse') {
        const requestState = requestStates.get(payload.messageId);
        if (requestState) {
          if (payload.error) {
            requestState.reject(payload.error);
          } else {
            requestState.resolve(payload.response);
          }
        }
      } else if (payload.type === 'methodCallback') {
        const requestState = requestStates.get(payload.messageId);
        requestState?.callback?.(...payload.callbackArgs);
      } else if (payload.type === 'unhandledError') {
        throw new Error(payload.error?.message);
      }
    });
  }

  private postMessageOnTickEnd(payload: OriginPayload, transferables?: Transferable[]) {
    this.pendingPayloads.push(payload);

    if (transferables) {
      this.pendingTransferables.push(...transferables);
    }

    this.postMessagesOnTickEnd();
  }

  private postMessagesOnTickEnd = throttleWithTickEnd(() => {
    const { channel } = this;
    const payloads = this.pendingPayloads;
    const transferables = this.pendingTransferables;

    this.pendingPayloads = [];
    this.pendingTransferables = [];

    this.target.postMessage({ channel, payloads }, transferables);
  });
}

export function createConnector<T extends InputRequestTypes>(
  worker: Worker,
  onUpdate?: (update: ApiUpdate) => void,
  channel?: string,
) {
  const connector = new ConnectorClass<T>(worker, onUpdate, channel);

  function handleMessage({ data }: WorkerMessageEvent) {
    connector.onMessage(data);
  }

  worker.addEventListener('message', handleMessage);

  connector.destroy = () => {
    worker.removeEventListener('message', handleMessage);
  };

  return connector;
}

export type Connector<T extends InputRequestTypes = InputRequestTypes> = ReturnType<typeof createConnector<T>>;
