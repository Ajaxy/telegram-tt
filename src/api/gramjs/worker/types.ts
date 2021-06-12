import { ApiSessionData, ApiUpdate } from '../../types';
import { Methods, MethodArgs, MethodResponse } from '../methods/types';

export type ThenArg<T> = T extends Promise<infer U> ? U : T;

export type WorkerMessageData = {
  type: 'update';
  update: ApiUpdate;
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
};

export interface WorkerMessageEvent {
  data: WorkerMessageData;
}

export type OriginRequest = {
  type: 'initApi';
  messageId?: string;
  args: [ApiSessionData | undefined];
} | {
  type: 'callMethod';
  messageId?: string;
  name: keyof Methods;
  args: MethodArgs<keyof Methods>;
};

export type OriginMessageData = OriginRequest | {
  type: 'cancelProgress';
  messageId: string;
};

export interface OriginMessageEvent {
  data: OriginMessageData;
}
