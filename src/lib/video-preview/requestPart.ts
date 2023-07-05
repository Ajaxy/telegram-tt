import generateUniqueId from '../../util/generateUniqueId';
import { pause } from '../../util/schedulers';

declare const self: WorkerGlobalScope;

type RequestStates = {
  resolve: (response: ArrayBuffer) => void;
  reject: () => void;
};

type RequestPartParams = { url: string; start: number; end: number };

const PART_TIMEOUT = 30000;

const requestStates = new Map<string, RequestStates>();

export function requestPart(params: RequestPartParams): Promise<ArrayBuffer | undefined> {
  const messageId = generateUniqueId();
  const requestState = {} as RequestStates;

  let isResolved = false;
  const promise = Promise.race([
    pause(PART_TIMEOUT).then(() => (isResolved ? undefined : Promise.reject(new Error('ERROR_PART_TIMEOUT')))),
    new Promise<ArrayBuffer>((resolve, reject) => {
      Object.assign(requestState, { resolve, reject });
    }),
  ]);

  requestStates.set(messageId, requestState);

  promise
    .catch(() => undefined)
    .finally(() => {
      requestStates.delete(messageId);
      isResolved = true;
    });

  const message = {
    type: 'requestPart',
    messageId,
    params,
  };

  postMessage(message);

  return promise;
}

self.addEventListener('message', (e) => {
  const { type, messageId, result } = (e as any).data as {
    type: string;
    messageId: string;
    result: ArrayBuffer;
  };

  if (type === 'partResponse') {
    const requestState = requestStates.get(messageId);
    if (requestState) {
      requestState.resolve(result);
    }
  }
});
