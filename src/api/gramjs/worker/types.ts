import type { DebugLevel } from '../../../util/debugConsole';
import type { ApiInitialArgs, ApiUpdate } from '../../types';
import type { LocalDb } from '../localDb';
import type { MethodArgs, MethodResponse, Methods } from '../methods/types';

export type ThenArg<T> = T extends Promise<infer U> ? U : T;

export type WorkerMessageData = {
  type: 'updates';
  updates: ApiUpdate[];
} | {
  type: 'methodResponse';
  messageId: string;
  response?: ThenArg<MethodResponse<keyof Methods>>;
  error?: { message: string };
} | {
  type: 'methodCallback';
  messageId: string;
  callbackArgs: any[];
} | {
  type: 'unhandledError';
  error?: { message: string };
} | {
  type: 'sendBeacon';
  url: string;
  data: ArrayBuffer;
} | {
  type: 'debugLog';
  level: DebugLevel;
  args: any[];
};

export interface WorkerMessageEvent {
  data: WorkerMessageData;
}

export type OriginRequest = {
  type: 'initApi';
  messageId?: string;
  args: [ApiInitialArgs, LocalDb];
} | {
  type: 'callMethod';
  messageId?: string;
  name: keyof Methods;
  args: MethodArgs<keyof Methods>;
  withCallback?: boolean;
} | {
  type: 'ping';
  messageId?: string;
} | {
  type: 'toggleDebugMode';
  messageId?: string;
  isEnabled?: boolean;
};

export type OriginMessageData = OriginRequest | {
  type: 'cancelProgress';
  messageId: string;
};

export interface OriginMessageEvent {
  data: OriginMessageData;
}
