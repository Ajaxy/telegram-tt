/* eslint-disable eslint-multitab-tt/set-global-only-variable */
import { getActions, getGlobal, setGlobal } from '../global';

import type { MethodArgs, Methods } from '../api/gramjs/methods/types';
import type { LocalDb } from '../api/gramjs/localDb';
import type { ApiInitialArgs } from '../api/types';
import type { GlobalState } from '../global/types';

import { IS_MULTITAB_SUPPORTED } from './environment';
import { APP_VERSION, DATA_BROADCAST_CHANNEL_NAME, MULTITAB_LOCALSTORAGE_KEY } from '../config';
import { deepMerge } from './deepMerge';
import { selectTabState } from '../global/selectors';
import {
  callApiLocal,
  cancelApiProgressMaster,
  handleMethodCallback,
  handleMethodResponse,
  initApi,
  updateFullLocalDb,
  updateLocalDb,
} from '../api/gramjs';
import { addCallback } from '../lib/teact/teactn';
import { deepDiff } from './deepDiff';
import { getCurrentTabId, signalPasscodeHash, subscribeToTokenDied } from './establishMultitabRole';
import { omit } from './iteratees';

type BroadcastChannelRequestGlobal = {
  type: 'requestGlobal';
  token?: number;
  appVersion: string;
};

type BroadcastChannelGlobalUpdate = {
  type: 'globalUpdate';
  global: GlobalState;
};

type BroadcastChannelCancelApiProgress = {
  type: 'cancelApiProgress';
  token: number;
  messageId: string;
};

type BroadcastChannelCallApi = {
  type: 'callApi';
  token: number;
  messageId: string;
  name: keyof Methods;
  args: MethodArgs<keyof Methods>;
  withCallback?: boolean;
};

type BroadcastChannelMessageResponse = {
  type: 'messageResponse';
  token: number;
  messageId: string;
  response: any;
};

type BroadcastChannelLocalDbUpdate = {
  type: 'localDbUpdate';
  batchedUpdates: {
    name: keyof LocalDb;
    prop: string;
    value: any;
  }[];
};

type BroadcastChannelLocalDbUpdateFull = {
  type: 'localDbUpdateFull';
  localDb: any;
};

type BroadcastChannelMessageCallback = {
  type: 'messageCallback';
  token: number;
  messageId: string;
  callbackArgs: any;
};

type BroadcastChannelGlobalDiff = {
  type: 'globalDiffUpdate';
  diff: any;
};

type BroadcastChannelInitApi = {
  type: 'initApi';
  token: number;
  initialArgs: ApiInitialArgs;
};

const MULTITAB_ESTABLISH_TIMEOUT = 800;

export type TypedBroadcastChannel = {
  postMessage: (message: BroadcastChannelMessage) => void;
  addEventListener: (type: 'message', listener: (event: { data: BroadcastChannelMessage }) => void) => void;
  removeEventListener: (type: 'message', listener: (event: { data: BroadcastChannelMessage }) => void) => void;
};

type BroadcastChannelMessage = (
  BroadcastChannelRequestGlobal | BroadcastChannelGlobalUpdate | BroadcastChannelCallApi |
  BroadcastChannelMessageResponse |
  BroadcastChannelMessageCallback | BroadcastChannelCancelApiProgress | BroadcastChannelLocalDbUpdate |
  BroadcastChannelLocalDbUpdateFull | BroadcastChannelGlobalDiff | BroadcastChannelInitApi
);

let resolveGlobalPromise: VoidFunction | undefined;
let isFirstGlobalResolved = false;
let prevGlobal: GlobalState | undefined;
let isDisabled = false;

const channel = IS_MULTITAB_SUPPORTED
  ? new BroadcastChannel(DATA_BROADCAST_CHANNEL_NAME) as TypedBroadcastChannel
  : undefined;

export function unsubcribeFromMultitabBroadcastChannel() {
  if (channel) {
    channel.removeEventListener('message', handleMessage);
    isDisabled = true;
  }
}

export function subscribeToMultitabBroadcastChannel() {
  if (!channel) return;

  subscribeToTokenDied((token) => {
    if (token === getCurrentTabId()) {
      unsubcribeFromMultitabBroadcastChannel();
      const global = getGlobal();
      const newGlobal = {
        ...global,
        byTabId: omit(global.byTabId, [token]),
      };

      const diff = deepDiff(global, newGlobal);

      if (typeof diff !== 'symbol') {
        channel.postMessage({
          type: 'globalDiffUpdate',
          diff,
        });
      }
      return;
    }
    let global = getGlobal();
    global = {
      ...global,
      byTabId: omit(global.byTabId, [token]),
    };

    setGlobal(global);
  });

  addCallback((global: GlobalState) => {
    if (!isFirstGlobalResolved || isDisabled) {
      prevGlobal = global;
      return;
    }

    if (!prevGlobal) {
      prevGlobal = global;
      channel.postMessage({
        type: 'globalUpdate',
        global,
      });
      return;
    }
    const diff = deepDiff(prevGlobal, global);

    if (typeof diff !== 'symbol') {
      channel.postMessage({
        type: 'globalDiffUpdate',
        diff,
      });
    }

    prevGlobal = global;
  }, true);

  channel.addEventListener('message', handleMessage);
}

export function handleMessage({ data }: { data: BroadcastChannelMessage }) {
  if (!data || !channel) return;

  switch (data.type) {
    case 'initApi': {
      const global = getGlobal();
      if (!selectTabState(global).isMasterTab) return;

      const { initialArgs } = data;
      initApi(getActions().apiUpdate, initialArgs);
      break;
    }

    case 'globalDiffUpdate': {
      if (!isFirstGlobalResolved) return;
      const { diff } = data;
      const oldGlobal = getGlobal();
      const global = deepMerge(oldGlobal, diff);
      // @ts-ignore
      global.DEBUG_capturedId = oldGlobal.DEBUG_capturedId;

      setGlobal(global, { noUpdate: true });
      prevGlobal = global;
      break;
    }

    case 'globalUpdate': {
      if (isFirstGlobalResolved) return;
      const oldGlobal = getGlobal();
      // @ts-ignore
      data.global.DEBUG_capturedId = oldGlobal.DEBUG_capturedId;
      setGlobal(data.global, { noUpdate: true });
      prevGlobal = data.global;
      if (resolveGlobalPromise) {
        resolveGlobalPromise();
        resolveGlobalPromise = undefined;
        isFirstGlobalResolved = true;
      }
      break;
    }

    case 'requestGlobal': {
      const { appVersion } = data;
      if (appVersion !== APP_VERSION) {
        // If app version on the other tab was updated, reload the current page immediately and don't respond
        // to the other tab's request because our current global might be incompatible with the new version
        window.location.reload();
        return;
      }

      if (!isFirstGlobalResolved) return;
      const global = getGlobal();

      if (!selectTabState(global).isMasterTab) return;

      channel.postMessage({
        type: 'globalUpdate',
        global,
      });

      signalPasscodeHash();
      break;
    }

    case 'messageCallback': {
      if (!isFirstGlobalResolved) return;
      const global = getGlobal();
      if (selectTabState(global).isMasterTab) return;

      handleMethodCallback(data);
      break;
    }

    case 'localDbUpdate': {
      if (!isFirstGlobalResolved) return;
      const global = getGlobal();
      if (selectTabState(global).isMasterTab) return;

      const {
        batchedUpdates,
      } = data;

      batchedUpdates.forEach(({
        name,
        prop,
        value,
      }) => {
        updateLocalDb(name, prop, value);
      });
      break;
    }

    case 'localDbUpdateFull': {
      if (!isFirstGlobalResolved) return;
      const global = getGlobal();
      if (selectTabState(global).isMasterTab) return;

      const { localDb } = data;

      updateFullLocalDb(localDb);
      break;
    }

    case 'messageResponse': {
      if (!isFirstGlobalResolved) return;
      const global = getGlobal();

      if (selectTabState(global).isMasterTab) return;

      handleMethodResponse(data);
      break;
    }

    case 'cancelApiProgress': {
      if (!isFirstGlobalResolved) return;
      const global = getGlobal();
      if (!selectTabState(global).isMasterTab) return;

      const { messageId } = data;

      cancelApiProgressMaster(messageId);
      break;
    }

    case 'callApi': {
      if (!isFirstGlobalResolved) return;
      const global = getGlobal();
      if (!selectTabState(global).isMasterTab) return;

      const {
        name, messageId, token, args, withCallback,
      } = data;

      const argsWithCallback = (withCallback ? [...args, (...callbackArgs: any[]) => {
        channel.postMessage({
          type: 'messageCallback',
          token,
          messageId,
          callbackArgs,
        });
      }] : args) as MethodArgs<keyof Methods>;

      (async () => {
        const result = await (callApiLocal(name, ...argsWithCallback));

        channel.postMessage({
          type: 'messageResponse',
          token,
          messageId,
          response: result,
        });
      })();

      break;
    }
  }
}

export function requestGlobal(appVersion: string): Promise<void> {
  if (channel) {
    channel.postMessage({
      type: 'requestGlobal',
      appVersion,
    });
  }

  const resolveWithoutGlobal = () => {
    if (resolveGlobalPromise) {
      resolveGlobalPromise();
      resolveGlobalPromise = undefined;
    }
    isFirstGlobalResolved = true;
  };

  if (localStorage.getItem(MULTITAB_LOCALSTORAGE_KEY)) {
    setTimeout(resolveWithoutGlobal, MULTITAB_ESTABLISH_TIMEOUT);
  } else {
    resolveWithoutGlobal();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    resolveGlobalPromise = resolve;
  });
}
