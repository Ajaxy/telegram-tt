import type { TrackKey } from './mediaPool';

import { type CallbackManager, createCallbackManager } from '../callbacks';
import safePlay from '../safePlay';
import { peek } from './mediaPool';

const containers = new Map<TrackKey, Set<HTMLDivElement>>();
const listenersByKey = new Map<TrackKey, CallbackManager<NoneToVoidFunction>>();
let floatingContainer: HTMLDivElement | undefined;

export function registerRoundVideoContainer(key: TrackKey, element: HTMLDivElement) {
  if (!containers.has(key)) containers.set(key, new Set());
  containers.get(key)!.add(element);
  listenersByKey.get(key)?.runCallbacks();

  return () => {
    const player = peek(key);
    if (player?.parentElement === element && floatingContainer?.isConnected) {
      // Reattach in the same teardown before the browser pauses a disconnected media element
      moveRoundVideoToContainer(player, floatingContainer);
    }

    const entries = containers.get(key)!;
    entries.delete(element);
    if (!entries.size) containers.delete(key);
    listenersByKey.get(key)?.runCallbacks();
  };
}

export function registerFloatingRoundVideoContainer(element: HTMLDivElement) {
  floatingContainer = element;

  return () => {
    if (floatingContainer === element) floatingContainer = undefined;
  };
}

export function getRoundVideoContainers(key: TrackKey) {
  return containers.get(key);
}

export function subscribeRoundVideoContainers(key: TrackKey, callback: NoneToVoidFunction) {
  if (!listenersByKey.has(key)) listenersByKey.set(key, createCallbackManager<NoneToVoidFunction>());
  const listeners = listenersByKey.get(key)!;
  const unsubscribe = listeners.addCallback(callback);

  return () => {
    unsubscribe();
    if (!listeners.hasCallbacks()) listenersByKey.delete(key);
  };
}

export function moveRoundVideoToContainer(player: HTMLMediaElement, container: HTMLDivElement) {
  if (player.parentElement === container) return;

  // Both views adopt the same pooled video, preserving its playback position and paused state
  const shouldResume = !player.paused;
  container.appendChild(player);
  if (shouldResume) safePlay(player);
}
