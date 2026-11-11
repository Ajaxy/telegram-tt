// Wallpaper blobs live in account-independent IDB storage. Cache API entries are legacy fallbacks
// that can be evicted by the browser and are moved to IDB when found.
import type { ApiWallpaper } from '../../api/types';
import type { IThemeSettings, ThemeKey } from '../../types';
import { ApiMediaFormat } from '../../api/types';

import { CUSTOM_BG_CACHE_NAME, WALLPAPER_SNAPSHOT_CACHE_NAME } from '../../config';
import { MAIN_IDB_STORE } from '../browser/idb';
import { IS_IOS } from '../browser/windowEnvironment';
import * as cacheApi from '../cacheApi';
import { sampleImageEdgeColors } from '../colors';
import { fetchBlob, preloadImage } from '../files';
import * as mediaLoader from '../mediaLoader';
import { getAccountSlots } from '../multiaccount';
import {
  clearWallpaperVaultBlobs,
  loadPasscodeMeta,
  readWallpaperVaultBlob,
  readWallpaperVaultBlobs,
  removeWallpaperVaultBlob,
  requestPasscodeStateLock,
  writeWallpaperVaultBlob,
} from '../passcode';
import { isSessionStoreLocked } from '../passcode/sessionStore';
import { decodeWallpaperPatternBlob } from './index';

type WallpaperUrlEntry = {
  promise: Promise<string>;
  refCount: number;
  // Kept for the synchronous first-render path (`getResolvedWallpaperUrl`)
  url?: string;
  edgeColors?: ReturnType<typeof sampleImageEdgeColors>;
  revokeTimeout?: number;
};

export type WallpaperUrlHandle = {
  promise: Promise<string>;
  release: NoneToVoidFunction;
};

export type WallpaperStorageSource = 'lockScreen';

const THEME_KEYS: ThemeKey[] = ['light', 'dark'];
const URL_REVOKE_DELAY_MS = 2000;
const BLOB_CLEANUP_DELAY_MS = 5000;
const WALLPAPER_STORE_KEY_PREFIX = 'wallpaper-';
const LOCK_SCREEN_WALLPAPER_STORE_KEY_PREFIX = 'lock-screen-wallpaper-';

const wallpaperUrlEntries = new Map<string, WallpaperUrlEntry>();
const blobCleanupTimeouts = new Map<string, number>();
const pendingThemeWallpapers = new Map<string, Promise<boolean>>();

export function saveWallpaperBlob(slug: string, blob: Blob) {
  return requestPasscodeStateLock(async () => {
    const storageKey = buildWallpaperStoreKey(slug);
    const hasPasscode = Boolean(await loadPasscodeMeta());

    try {
      if (hasPasscode) {
        await writeWallpaperVaultBlob(slug, blob);
        await MAIN_IDB_STORE.del(storageKey);
        return true;
      }

      await MAIN_IDB_STORE.set(storageKey, blob);
      return true;
    } catch (err) {
      if (hasPasscode) await MAIN_IDB_STORE.del(storageKey).catch(() => undefined);
      // eslint-disable-next-line no-console
      console.warn(err);
      return false;
    }
  });
}

export async function cacheWallpaperMedia(wallpaper: ApiWallpaper, mediaUrl: string) {
  const rawBlob = await fetchBlob(mediaUrl);
  const blob = wallpaper.isPattern ? await decodeWallpaperPatternBlob(rawBlob) : rawBlob;
  return saveWallpaperBlob(wallpaper.slug, blob);
}

export function cacheThemeWallpaper(wallpaper: ApiWallpaper): Promise<boolean> {
  if (!wallpaper.document) return Promise.resolve(false);

  const pending = pendingThemeWallpapers.get(wallpaper.slug);
  if (pending) return pending;

  const promise = loadThemeWallpaper(wallpaper).finally(() => {
    pendingThemeWallpapers.delete(wallpaper.slug);
  });
  pendingThemeWallpapers.set(wallpaper.slug, promise);
  cancelBlobCleanup(wallpaper.slug);
  return promise;
}

async function loadThemeWallpaper(wallpaper: ApiWallpaper): Promise<boolean> {
  try {
    if (await loadStoredWallpaperBlob(wallpaper.slug)) return true;

    const url = await mediaLoader.fetch(`wallpaper${wallpaper.document!.id}`, ApiMediaFormat.BlobUrl);
    return url ? await cacheWallpaperMedia(wallpaper, url) : false;
  } catch {
    return false;
  }
}

export async function encryptWallpaperBlobs() {
  try {
    const storageKeys = await getPlaintextWallpaperKeys();
    for (const storageKey of storageKeys) {
      const blob = await MAIN_IDB_STORE.get<Blob>(storageKey);
      if (!blob) continue;

      await writeWallpaperVaultBlob(getWallpaperSlug(storageKey), blob);
    }

    await removePlaintextWallpaperBlobs(storageKeys);
  } catch (err) {
    await clearPlaintextWallpaperBlobs().catch(() => undefined);
    throw err;
  }
}

export async function restoreWallpaperBlobsFromPasscode() {
  const blobs = await readWallpaperVaultBlobs();
  const entries: [string, Blob][] = blobs.map(([slug, blob]) => [buildWallpaperStoreKey(slug), blob]);
  if (!entries.length) return;

  await MAIN_IDB_STORE.setMany(entries);
}

export async function clearPlaintextWallpaperBlobs() {
  const storageKeys = await getPlaintextWallpaperKeys();
  await removePlaintextWallpaperBlobs(storageKeys);
}

export async function syncLockScreenWallpaperBlobs(selectedBackgrounds: string[]) {
  const selectedSlugs = [...new Set(selectedBackgrounds.filter(isBlobWallpaper))];
  const selectedStorageKeys = new Set(selectedSlugs.map(buildLockScreenWallpaperStoreKey));
  const storedKeys = await getLockScreenWallpaperKeys();
  const staleKeys = storedKeys.filter((storageKey) => !selectedStorageKeys.has(storageKey));
  const entries: [string, Blob][] = [];

  for (const slug of selectedSlugs) {
    const blob = await loadStoredWallpaperBlob(slug);
    if (blob) entries.push([buildLockScreenWallpaperStoreKey(slug), blob]);
  }

  if (entries.length) await MAIN_IDB_STORE.setMany(entries);
  if (staleKeys.length) await MAIN_IDB_STORE.delMany(staleKeys);
}

export async function clearLockScreenWallpaperBlobs() {
  const storageKeys = await getLockScreenWallpaperKeys();
  if (storageKeys.length) await MAIN_IDB_STORE.delMany(storageKeys);
}

export async function clearWallpaperBlobs() {
  try {
    await Promise.all([
      clearPlaintextWallpaperBlobs(),
      clearLockScreenWallpaperBlobs(),
      clearWallpaperVaultBlobs(),
      cacheApi.clearShared(CUSTOM_BG_CACHE_NAME),
      cacheApi.clearShared(WALLPAPER_SNAPSHOT_CACHE_NAME),
      cacheApi.clearAccountScopes(CUSTOM_BG_CACHE_NAME),
    ]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(err);
  }
}

export async function migrateLegacyWallpaperBlobs(
  themes: Partial<Record<ThemeKey, IThemeSettings>>,
) {
  const migratedSlugs = new Set<string>();

  for (const theme of THEME_KEYS) {
    const slug = themes[theme]?.background;
    if (!isBlobWallpaper(slug) || migratedSlugs.has(slug)) continue;

    migratedSlugs.add(slug);
    if (await loadStoredWallpaperBlob(slug)) continue;

    const legacyBlob = await cacheApi.fetchShared(CUSTOM_BG_CACHE_NAME, slug, cacheApi.Type.Blob)
      || await cacheApi.fetchFromCurrentAccountScope(CUSTOM_BG_CACHE_NAME, slug, cacheApi.Type.Blob)
      || await cacheApi.fetchFromCurrentAccountScope(CUSTOM_BG_CACHE_NAME, theme, cacheApi.Type.Blob);
    if (legacyBlob) {
      await saveWallpaperBlob(slug, legacyBlob);
    }
  }
}

export function updateSelectedWallpaperBlobs(
  selectedBackgrounds: string[],
  previousBackground: string | undefined,
  getSelectedBackgrounds: () => string[],
  shouldKeepLockScreenBackground: boolean,
) {
  selectedBackgrounds.forEach(cancelBlobCleanup);

  void requestPasscodeStateLock(async () => {
    if (!await loadPasscodeMeta()) return;
    if (!shouldKeepLockScreenBackground) {
      await clearLockScreenWallpaperBlobs();
      return;
    }
    await syncLockScreenWallpaperBlobs(selectedBackgrounds);
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.warn(err);
  });

  if (!isBlobWallpaper(previousBackground) || selectedBackgrounds.includes(previousBackground)) return;

  removeWallpaperBlobIfUnused(previousBackground, getSelectedBackgrounds);
}

export function removeWallpaperBlobIfUnused(
  background: string,
  getSelectedBackgrounds: () => string[],
) {
  if (!isBlobWallpaper(background)) return;

  cancelBlobCleanup(background);
  const timeout = window.setTimeout(() => {
    blobCleanupTimeouts.delete(background);
    // Shared blobs can be referenced by other accounts whose peer state is unavailable here
    if (isSessionStoreLocked() || getAccountSlots().length > 1) return;
    if (!pendingThemeWallpapers.has(background) && !getSelectedBackgrounds().includes(background)) {
      void removeWallpaperBlob(background);
    }
  }, BLOB_CLEANUP_DELAY_MS);
  blobCleanupTimeouts.set(background, timeout);
}

// Starts resolving the wallpaper into a preloaded object URL ahead of the first render.
// Accepts any background value: colors and `undefined` are ignored.
export async function prefetchWallpaperUrl(background?: string) {
  if (!isBlobWallpaper(background)) return;

  try {
    await getOrCreateWallpaperUrlEntry(background).promise;
  } catch {
    // The background hook retries the lookup and resets missing wallpaper settings
  }
}

// Synchronous counterpart of `acquireWallpaperUrl` for the first render: returns the URL only when
// it is already loaded (e.g. prefetched). The caller must still acquire a handle to keep it alive.
export function getResolvedWallpaperUrl(slug: string, source?: WallpaperStorageSource) {
  return wallpaperUrlEntries.get(buildWallpaperUrlKey(slug, source))?.url;
}

export function getResolvedWallpaperEdgeColors(slug: string, source?: WallpaperStorageSource) {
  return wallpaperUrlEntries.get(buildWallpaperUrlKey(slug, source))?.edgeColors;
}

export function acquireWallpaperUrl(slug: string, source?: WallpaperStorageSource): WallpaperUrlHandle {
  const storageKey = buildWallpaperUrlKey(slug, source);
  const entry = getOrCreateWallpaperUrlEntry(slug, source);
  entry.refCount += 1;
  if (entry.revokeTimeout !== undefined) {
    clearTimeout(entry.revokeTimeout);
    entry.revokeTimeout = undefined;
  }

  let isReleased = false;
  return {
    promise: entry.promise,
    release() {
      if (isReleased) return;
      isReleased = true;
      releaseWallpaperUrlEntry(storageKey, entry);
    },
  };
}

function getOrCreateWallpaperUrlEntry(slug: string, source?: WallpaperStorageSource) {
  const storageKey = buildWallpaperUrlKey(slug, source);
  const existing = wallpaperUrlEntries.get(storageKey);
  if (existing) return existing;

  const entry: WallpaperUrlEntry = {
    promise: loadWallpaperUrl(slug, source).then(({ url, edgeColors }) => {
      entry.url = url;
      entry.edgeColors = edgeColors;
      return url;
    }),
    refCount: 0,
  };
  entry.promise.catch(() => {
    if (wallpaperUrlEntries.get(storageKey) === entry) {
      wallpaperUrlEntries.delete(storageKey);
    }
  });
  wallpaperUrlEntries.set(storageKey, entry);
  return entry;
}

async function loadWallpaperUrl(slug: string, source?: WallpaperStorageSource) {
  const blob = await loadWallpaperBlob(slug, source);
  const url = URL.createObjectURL(blob);

  try {
    const image = await preloadImage(url);
    return {
      url,
      edgeColors: IS_IOS && source !== 'lockScreen' ? sampleImageEdgeColors(image) : undefined,
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

async function loadWallpaperBlob(slug: string, source?: WallpaperStorageSource): Promise<Blob> {
  if (source === 'lockScreen') {
    const blob = await requestPasscodeStateLock(
      () => MAIN_IDB_STORE.get<Blob>(buildLockScreenWallpaperStoreKey(slug)),
    );
    if (!blob) throw new Error('LOCK_SCREEN_BG_MISSING');
    return blob;
  }

  const storedBlob = await loadStoredWallpaperBlob(slug);
  if (storedBlob) return storedBlob;
  if (await loadPasscodeMeta()) throw new Error('CUSTOM_BG_MISSING');

  const legacyBlob = await cacheApi.fetchShared(CUSTOM_BG_CACHE_NAME, slug, cacheApi.Type.Blob)
    || await cacheApi.fetchFromAccountScopes(CUSTOM_BG_CACHE_NAME, slug, cacheApi.Type.Blob);
  if (!legacyBlob) {
    throw new Error('CUSTOM_BG_MISSING');
  }

  await saveWallpaperBlob(slug, legacyBlob);
  return legacyBlob;
}

async function loadStoredWallpaperBlob(slug: string) {
  try {
    const meta = await loadPasscodeMeta();
    if (!meta) {
      return await MAIN_IDB_STORE.get<Blob>(buildWallpaperStoreKey(slug));
    }
    return await readWallpaperVaultBlob(slug);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(err);
    return undefined;
  }
}

async function removeWallpaperBlob(slug: string) {
  await Promise.all([
    cacheApi.removeShared(CUSTOM_BG_CACHE_NAME, slug),
    cacheApi.removeFromAccountScopes(CUSTOM_BG_CACHE_NAME, slug),
  ]);

  try {
    await Promise.all([
      MAIN_IDB_STORE.del(buildWallpaperStoreKey(slug)),
      removeWallpaperVaultBlob(slug),
    ]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(err);
  }
}

function releaseWallpaperUrlEntry(storageKey: string, entry: WallpaperUrlEntry) {
  entry.refCount -= 1;
  if (entry.refCount > 0) return;

  entry.revokeTimeout = window.setTimeout(() => {
    if (wallpaperUrlEntries.get(storageKey) === entry) {
      wallpaperUrlEntries.delete(storageKey);
    }
    entry.promise.then((url) => URL.revokeObjectURL(url)).catch(() => undefined);
  }, URL_REVOKE_DELAY_MS);
}

function cancelBlobCleanup(slug: string) {
  const timeout = blobCleanupTimeouts.get(slug);
  if (timeout === undefined) return;

  clearTimeout(timeout);
  blobCleanupTimeouts.delete(slug);
}

function buildWallpaperStoreKey(slug: string) {
  return `${WALLPAPER_STORE_KEY_PREFIX}${slug}`;
}

function buildLockScreenWallpaperStoreKey(slug: string) {
  return `${LOCK_SCREEN_WALLPAPER_STORE_KEY_PREFIX}${slug}`;
}

function buildWallpaperUrlKey(slug: string, source?: WallpaperStorageSource) {
  return source ? `${source}:${slug}` : slug;
}

function getWallpaperSlug(storageKey: string) {
  return storageKey.slice(WALLPAPER_STORE_KEY_PREFIX.length);
}

async function getPlaintextWallpaperKeys() {
  const storageKeys = await MAIN_IDB_STORE.keys();
  return storageKeys.filter(
    (storageKey): storageKey is string => (
      typeof storageKey === 'string' && storageKey.startsWith(WALLPAPER_STORE_KEY_PREFIX)
    ),
  );
}

async function getLockScreenWallpaperKeys() {
  const storageKeys = await MAIN_IDB_STORE.keys();
  return storageKeys.filter(
    (storageKey): storageKey is string => (
      typeof storageKey === 'string' && storageKey.startsWith(LOCK_SCREEN_WALLPAPER_STORE_KEY_PREFIX)
    ),
  );
}

async function removePlaintextWallpaperBlobs(storageKeys: string[]) {
  if (!storageKeys.length) return;

  await MAIN_IDB_STORE.delMany(storageKeys);
}

function isBlobWallpaper(background?: string): background is string {
  return Boolean(background && !background.startsWith('#'));
}
