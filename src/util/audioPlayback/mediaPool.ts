export type TrackKey =
  | `msg:${string}:${number}`
  | `msg:${string}:${number}:${string}`
  | `savedMusic:${string}:${string}`
  | `musicSearch:${string}`
  | `iv:${string}:${string}`
  | `draft:${string}`;

type PoolEntry = {
  element: HTMLAudioElement;
  consumerCount: number;
};

const pool = new Map<TrackKey, PoolEntry>();
const keyAliases = new Map<TrackKey, TrackKey>();
const destroyListeners = new Set<(element: HTMLAudioElement) => void>();

let pinnedKey: TrackKey | undefined;

export function acquire(key: TrackKey) {
  key = resolveKey(key);
  let entry = pool.get(key);

  if (!entry) {
    const element = new Audio();
    element.preload = 'none';
    entry = { element, consumerCount: 0 };
    pool.set(key, entry);
  }

  entry.consumerCount++;

  return entry.element;
}

export function release(key: TrackKey) {
  key = resolveKey(key);
  const entry = pool.get(key);
  if (!entry || entry.consumerCount === 0) return;

  entry.consumerCount--;
  destroyIfUnused(key);
}

export function peek(key: TrackKey) {
  return pool.get(resolveKey(key))?.element;
}

function resolveKey(key: TrackKey) {
  let resolved = key;
  while (keyAliases.has(resolved)) {
    resolved = keyAliases.get(resolved)!;
  }

  return resolved;
}

export function onElementDestroy(listener: (element: HTMLAudioElement) => void) {
  destroyListeners.add(listener);

  return () => destroyListeners.delete(listener);
}

export function pin(key?: TrackKey) {
  const prevPinnedKey = pinnedKey;
  pinnedKey = key === undefined ? undefined : resolveKey(key);

  if (prevPinnedKey && prevPinnedKey !== key) {
    destroyIfUnused(prevPinnedKey);
  }
}

export function reassignKey(oldKey: TrackKey, newKey: TrackKey) {
  oldKey = resolveKey(oldKey);
  if (oldKey === newKey) return;

  const entry = pool.get(oldKey);
  if (!entry) return;

  const existing = pool.get(newKey);
  pool.delete(oldKey);
  pool.set(newKey, entry);
  keyAliases.set(oldKey, newKey);

  if (existing && existing !== entry) {
    entry.consumerCount += existing.consumerCount;
    destroyElement(existing.element);
  }

  if (pinnedKey === oldKey) {
    pinnedKey = newKey;
  }
}

function destroyIfUnused(key: TrackKey) {
  const entry = pool.get(key);
  if (!entry || entry.consumerCount > 0 || key === pinnedKey) return;

  destroyElement(entry.element);
  pool.delete(key);
  keyAliases.forEach((target, alias) => {
    if (resolveKey(target) === key) keyAliases.delete(alias);
  });
}

function destroyElement(element: HTMLAudioElement) {
  element.pause();
  element.removeAttribute('src');
  element.load();
  destroyListeners.forEach((listener) => listener(element));
}

export function makeMessageTrackKey(chatId: string, messageId: number, documentId?: string): TrackKey {
  return documentId ? `msg:${chatId}:${messageId}:${documentId}` : `msg:${chatId}:${messageId}`;
}

export function makeSavedMusicTrackKey(peerId: string, audioId: string): TrackKey {
  return `savedMusic:${peerId}:${audioId}`;
}

export function makeMusicSearchTrackKey(audioId: string): TrackKey {
  return `musicSearch:${audioId}`;
}

export function makeInstantViewTrackKey(webPageId: string, documentId: string): TrackKey {
  return `iv:${webPageId}:${documentId}`;
}

export function makeDraftTrackKey(attachmentUid: string): TrackKey {
  return `draft:${attachmentUid}`;
}
