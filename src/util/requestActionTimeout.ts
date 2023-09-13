import { getActions } from '../global';

import type { CallbackAction } from '../global/types';

const callbacks = new Map<string, number>();

export default function requestActionTimeout(action: CallbackAction, timeout: number) {
  const name = action.action;
  clearTimeout(callbacks.get(name));
  const timerId = window.setTimeout(() => {
    // @ts-ignore
    getActions()[name](action.payload);
  }, timeout);
  callbacks.set(name, timerId);
}
