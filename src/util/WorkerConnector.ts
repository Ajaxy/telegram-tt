import generateIdFor from './generateIdFor';

export interface CancellableCallback {
  (
    ...args: any[]
  ): void;

  isCanceled?: boolean;
  acceptsBuffer?: boolean;
}

type CallMethodData = {
  type: 'callMethod';
  messageId?: string;
  name: string;
  args: any;
  withCallback?: boolean;
};

type OriginMessageData = CallMethodData | {
  type: 'cancelProgress';
  messageId: string;
};

export interface OriginMessageEvent {
  data: OriginMessageData;
}

export type WorkerMessageData = {
  type: 'methodResponse';
  messageId: string;
  response?: any;
  error?: { message: string };
} | {
  type: 'methodCallback';
  messageId: string;
  callbackArgs: any[];
} | {
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

// TODO Replace `any` with proper generics
export default class WorkerConnector {
  private requestStates = new Map<string, RequestStates>();

  private requestStatesByCallback = new Map<AnyToVoidFunction, RequestStates>();

  constructor(private worker: Worker) {
    this.subscribe();
  }

  request(messageData: { name: string; args: any }) {
    const { worker, requestStates, requestStatesByCallback } = this;

    const messageId = generateIdFor(requestStates);
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

    worker.postMessage(payload);

    return promise;
  }

  cancelCallback(progressCallback: CancellableCallback) {
    progressCallback.isCanceled = true;

    const { messageId } = this.requestStatesByCallback.get(progressCallback) || {};
    if (!messageId) {
      return;
    }

    this.worker.postMessage({
      type: 'cancelProgress',
      messageId,
    });
  }

  private subscribe() {
    const { worker, requestStates } = this;

    worker.addEventListener('message', ({ data }: WorkerMessageEvent) => {
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
    });
  }
}
