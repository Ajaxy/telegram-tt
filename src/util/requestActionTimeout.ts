import { getActions } from '../global';
import type { GlobalActions } from '../global/types';

const callbacks = new Map<string, NodeJS.Timeout>();

export default function requestActionTimeout(action: keyof GlobalActions, timeout: number) {
  clearTimeout(callbacks.get(action));
  const timerId = setTimeout(() => {
    getActions()[action]();
  }, timeout);
  callbacks.set(action, timerId);
}
