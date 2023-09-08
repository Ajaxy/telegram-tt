import generateUniqueId from './generateUniqueId';

export interface CancellableCallback {
  (
    ...args: any[]
  ): void;

  isCanceled?: boolean;
}

type InitData = {
  channel?: string;
  type: 'init';
  messageId?: string;
  name: 'init';
  args: any;
};

type CallMethodData = {
  channel?: string;
  type: 'callMethod';
  messageId?: string;
  name: string;
  args: any;
  withCallback?: boolean;
};

export type OriginMessageData = InitData | CallMethodData | {
  channel?: string;
  type: 'cancelProgress';
  messageId: string;
};

export interface OriginMessageEvent {
  data: OriginMessageData;
}

export type ApiUpdate =
  { type: string }
  & any;

export type WorkerMessageData = {
  channel?: string;
  type: 'update';
  update: ApiUpdate;
} | {
  channel?: string;
  type: 'methodResponse';
  messageId: string;
  response?: any;
  error?: { message: string };
} | {
  channel?: string;
  type: 'methodCallback';
  messageId: string;
  callbackArgs: any[];
} | {
  channel?: string;
  type: 'unhandledError';
  error?: { message: string };
};

export interface WorkerMessageEvent {
  data: WorkerMessageData;
}

interface RequestStates {
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
  }
}>;

class ConnectorClass<T extends InputRequestTypes> {
  private requestStates = new Map<string, RequestStates>();

  private requestStatesByCallback = new Map<AnyToVoidFunction, RequestStates>();

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
    this.postMessage({
      type: 'init',
      args,
    });
  }

  request(messageData: RequestTypes<T>) {
    const { requestStates, requestStatesByCallback } = this;

    const messageId = generateUniqueId();
    const payload: CallMethodData = {
      type: 'callMethod',
      messageId,
      ...messageData,
    };

    const requestState = { messageId } as RequestStates;

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

    this.postMessage(payload);

    return promise;
  }

  cancelCallback(progressCallback: CancellableCallback) {
    progressCallback.isCanceled = true;

    const { messageId } = this.requestStatesByCallback.get(progressCallback) || {};
    if (!messageId) {
      return;
    }

    this.postMessage({
      type: 'cancelProgress',
      messageId,
    });
  }

  onMessage(data: WorkerMessageData) {
    const { requestStates, channel } = this;
    if (data.channel !== channel) {
      return;
    }

    if (data.type === 'update' && this.onUpdate) {
      this.onUpdate(data.update);
    }
    if (data.type === 'methodResponse') {
      const requestState = requestStates.get(data.messageId);
      if (requestState) {
        if (data.error) {
          requestState.reject(data.error);
        } else {
          requestState.resolve(data.response);
        }
      }
    } else if (data.type === 'methodCallback') {
      const requestState = requestStates.get(data.messageId);
      requestState?.callback?.(...data.callbackArgs);
    } else if (data.type === 'unhandledError') {
      throw new Error(data.error?.message);
    }
  }

  private postMessage(data: AnyLiteral) {
    data.channel = this.channel;

    this.target.postMessage(data);
  }
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
