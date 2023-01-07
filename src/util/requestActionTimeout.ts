import { getActions } from '../global';
import type { GlobalActions } from '../global/types';

const callbacks = new Map<string, number>();

export default function requestActionTimeout(action: keyof GlobalActions, timeout: number) {
  clearTimeout(callbacks.get(action));
  const timerId = window.setTimeout(() => {
    getActions()[action]();
  }, timeout);
  callbacks.set(action, timerId);
}
