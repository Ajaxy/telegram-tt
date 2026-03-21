import type { ActionOptions } from '../lib/teact/teactn';
import { typify } from '../lib/teact/teactn';

import type {
  ActionPayloads, GlobalState, RequiredActionPayloads, RequiredGlobalState,
} from './types';

const typed = typify<GlobalState, ActionPayloads & RequiredActionPayloads>();

type ProjectActionTypes =
  ActionPayloads
  & RequiredActionPayloads;

type ProjectActionNames = keyof ProjectActionTypes;

type Helper<T, E> = Exclude<T, E> extends never ? unknown : Exclude<T, E>;

export type TabStateActionNames = {
  [ActionName in ProjectActionNames]:
  'tabId' extends keyof Helper<ProjectActionTypes[ActionName], undefined> ? ActionName : never
}[ProjectActionNames];
// `Required` actions are called from actions to ensure the `tabId` is always provided if needed.
// There are three types of actions:
// 1. With tabId, which is made required when calling action from another action handler
// 2. Without payload (= undefined), hence made the payload not required
// 3. With payload, hence made the payload required
export type RequiredGlobalActions = {
  [ActionName in ProjectActionNames]: ActionName extends TabStateActionNames ? ((
    payload: ProjectActionTypes[ActionName] & { tabId: number },
    options?: ActionOptions,
  ) => void) :
    (undefined extends ProjectActionTypes[ActionName] ? (
      (payload?: ProjectActionTypes[ActionName], options?: ActionOptions) => void
    ) : (
      (payload: ProjectActionTypes[ActionName], options?: ActionOptions) => void
    ))
} & { _: never };

type ActionHandlers = {
  [ActionName in keyof ProjectActionTypes]: (
    global: RequiredGlobalState,
    actions: RequiredGlobalActions,
    payload: ProjectActionTypes[ActionName],
  ) => GlobalState | void | Promise<void>;
};

export const getGlobal = typed.getGlobal;
export const setGlobal = typed.setGlobal;
export const getActions = typed.getActions;
export const getPromiseActions = typed.getPromiseActions;
export const addActionHandler = typed.addActionHandler as <ActionName extends ProjectActionNames>(
  name: ActionName,
  handler: ActionHandlers[ActionName],
) => void;
export const execAfterActions = typed.execAfterActions;
export const withGlobal = typed.withGlobal;
export type GlobalActions = ReturnType<typeof getActions>;

// MODIFICATION: Expose API to window for external access
// Purpose: Enable external applications to access Telegram data
// License: GPL-3.0 (same as original)
// See: MODIFICATIONS.md for details
if (typeof window !== 'undefined') {
  (window as any).getGlobal = getGlobal;
  (window as any).getActions = getActions;

  const notReadyError = () => Promise.reject(new Error(
    'Telegram GramJS not ready yet. await window.__telegramDesktopBridge.ready then retry.',
  ));

  let resolveBridgeReady: (() => void) | undefined;
  const bridgeReady = new Promise<void>((resolve) => {
    resolveBridgeReady = resolve;
  });

  type TelegramDesktopBridge = {
    ready: Promise<void>;
    ping: () => boolean;
    /** Queues confirmation UI, then worker `auth.acceptLoginToken`. */
    acceptLoginToken: (tokenBase64: string, expires?: number) => Promise<void>;
  };

  /** Present immediately so host apps can detect fork vs stale deploy; methods work after `ready`. */
  const telegramDesktopBridge: TelegramDesktopBridge = {
    /** Resolves when `callApi` is wired to the worker. */
    ready: bridgeReady,
    ping: () => false,
    acceptLoginToken: (_tokenBase64, _expires) => notReadyError() as Promise<void>,
  };

  (window as any).__telegramDesktopBridge = telegramDesktopBridge;

  // Lazy import callApi to avoid circular dependencies
  import('../api/gramjs').then((api) => {
    (window as any).callApi = api.callApi;
    telegramDesktopBridge.ping = () => true;
    telegramDesktopBridge.acceptLoginToken = (tokenBase64: string, expires?: number) => {
      getActions().requestDesktopSessionLink({ tokenBase64, expires });
      return Promise.resolve();
    };
    resolveBridgeReady?.();
  });
}
// END MODIFICATION
