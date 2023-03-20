import type { GlobalActions } from '../global';
import { getActions } from '../global';

const callbacks = new Map<string, number>();

export default function requestActionTimeout(action: keyof GlobalActions, timeout: number) {
  clearTimeout(callbacks.get(action));
  const timerId = window.setTimeout(() => {
    (getActions()[action] as VoidFunction)();
  }, timeout);
  callbacks.set(action, timerId);
}
