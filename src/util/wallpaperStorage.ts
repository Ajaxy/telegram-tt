// Wallpaper blobs live in account-independent IDB storage. Cache API entries are legacy fallbacks
// that can be evicted by the browser and are moved to IDB when found.
import type { ApiWallpaper } from '../api/types';
import type { IThemeSettings, ThemeKey } from '../types';

import { CUSTOM_BG_CACHE_NAME } from '../config';
import { MAIN_IDB_STORE } from './browser/idb';
import * as cacheApi from './cacheApi';
import { fetchBlob, preloadImage } from './files';
import { decodeWallpaperPatternBlob } from './wallpaper';

type WallpaperUrlEntry = {
  promise: Promise<string>;
  refCount: number;
  // Kept for the synchronous first-render path (`getResolvedWallpaperUrl`)
  url?: string;
  revokeTimeout?: number;
};

export type WallpaperUrlHandle = {
  promise: Promise<string>;
  release: NoneToVoidFunction;
};

const THEME_KEYS: ThemeKey[] = ['light', 'dark'];
const URL_REVOKE_DELAY_MS = 2000;
const BLOB_CLEANUP_DELAY_MS = 5000;
const WALLPAPER_STORE_KEY_PREFIX = 'wallpaper-';

const wallpaperUrlEntries = new Map<string, WallpaperUrlEntry>();
const blobCleanupTimeouts = new Map<string, number>();

export async function saveWallpaperBlob(slug: string, blob: Blob) {
  try {
    await MAIN_IDB_STORE.set(buildWallpaperStoreKey(slug), blob);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(err);
    return false;
  }
}

export async function cacheWallpaperMedia(wallpaper: ApiWallpaper, mediaUrl: string) {
  const rawBlob = await fetchBlob(mediaUrl);
  const blob = wallpaper.isPattern ? await decodeWallpaperPatternBlob(rawBlob) : rawBlob;
  return saveWallpaperBlob(wallpaper.slug, blob);
}

export async function clearWallpaperBlobs() {
  await Promise.all([
    cacheApi.clearShared(CUSTOM_BG_CACHE_NAME),
    cacheApi.clearAccountScopes(CUSTOM_BG_CACHE_NAME),
  ]);

  try {
    const keys = await MAIN_IDB_STORE.keys();
    const wallpaperKeys = keys.filter(
      (key): key is string => typeof key === 'string' && key.startsWith(WALLPAPER_STORE_KEY_PREFIX),
    );
    await MAIN_IDB_STORE.delMany(wallpaperKeys);
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
) {
  selectedBackgrounds.forEach(cancelBlobCleanup);

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
    if (!getSelectedBackgrounds().includes(background)) {
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
export function getResolvedWallpaperUrl(slug: string) {
  return wallpaperUrlEntries.get(slug)?.url;
}

export function acquireWallpaperUrl(slug: string): WallpaperUrlHandle {
  const entry = getOrCreateWallpaperUrlEntry(slug);
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
      releaseWallpaperUrlEntry(slug, entry);
    },
  };
}

function getOrCreateWallpaperUrlEntry(slug: string) {
  const existing = wallpaperUrlEntries.get(slug);
  if (existing) return existing;

  const entry: WallpaperUrlEntry = {
    promise: loadWallpaperUrl(slug),
    refCount: 0,
  };
  entry.promise.then((url) => {
    entry.url = url;
  }, () => {
    if (wallpaperUrlEntries.get(slug) === entry) {
      wallpaperUrlEntries.delete(slug);
    }
  });
  wallpaperUrlEntries.set(slug, entry);
  return entry;
}

async function loadWallpaperUrl(slug: string) {
  const blob = await loadWallpaperBlob(slug);
  const url = URL.createObjectURL(blob);

  try {
    await preloadImage(url);
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }

  return url;
}

async function loadWallpaperBlob(slug: string): Promise<Blob> {
  const storedBlob = await loadStoredWallpaperBlob(slug);
  if (storedBlob) return storedBlob;

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
    return await MAIN_IDB_STORE.get<Blob>(buildWallpaperStoreKey(slug));
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
    await MAIN_IDB_STORE.del(buildWallpaperStoreKey(slug));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(err);
  }
}

function releaseWallpaperUrlEntry(slug: string, entry: WallpaperUrlEntry) {
  entry.refCount -= 1;
  if (entry.refCount > 0) return;

  entry.revokeTimeout = window.setTimeout(() => {
    if (wallpaperUrlEntries.get(slug) === entry) {
      wallpaperUrlEntries.delete(slug);
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

function isBlobWallpaper(background?: string): background is string {
  return Boolean(background && !background.startsWith('#'));
}
