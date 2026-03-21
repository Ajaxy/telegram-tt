import type { DebugLevel } from '../../../util/debugConsole';
import type {
  ApiInitialArgs, ApiUpdate,
} from '../../types';
import type { LocalDb } from '../localDb';
import type { MethodArgs, MethodResponse, Methods } from '../methods/types';

export type ThenArg<T> = T extends Promise<infer U> ? U : T;

export type WorkerPayload =
  {
    type: 'updates';
    updates: ApiUpdate[];
  }
  |
  {
    type: 'methodResponse';
    messageId: string;
    response?: ThenArg<MethodResponse<keyof Methods>>;
    error?: { message: string };
  }
  |
  {
    type: 'methodCallback';
    messageId: string;
    callbackArgs: any[];
  }
  |
  {
    type: 'unhandledError';
    error?: { message: string };
  }
  |
  {
    type: 'sendBeacon';
    url: string;
    data: ArrayBuffer;
  }
  |
  {
    type: 'debugLog';
    level: DebugLevel;
    args: any[];
  };

export type WorkerMessageData = {
  payloads: WorkerPayload[];
};

export type WorkerMessageEvent = {
  data: WorkerMessageData;
};

export type OriginPayload =
  {
    type: 'initApi';
    messageId?: string;
    args: [ApiInitialArgs, LocalDb];
  }
  |
  {
    type: 'callMethod';
    messageId?: string;
    name: keyof Methods;
    args: MethodArgs<keyof Methods>;
    withCallback?: boolean;
  }
  |
  {
    type: 'ping';
    messageId?: string;
  }
  |
  {
    type: 'toggleDebugMode';
    messageId?: string;
    isEnabled?: boolean;
  }
  |
  {
    type: 'cancelProgress';
    messageId: string;
  };

export type OriginMessageData = {
  payloads: OriginPayload[];
};

export type OriginMessageEvent = {
  data: OriginMessageData;
};
