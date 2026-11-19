// Stylesheets that `index.html` links and the service worker serves from the cache, so a page load
// paints them before any script runs. Like the wallpaper caches, they are not kept while a passcode is set.
import { SNAPSHOT_CACHE_NAME } from '../config';
import { loadPasscodeMeta, requestPasscodeStateLock } from './passcode/meta';

const KEY_HEADER = 'X-Snapshot-Key';

export async function saveCssSnapshot(path: string, key: string, buildCss: () => string | Promise<string>) {
  if (!self.caches || await loadPasscodeMeta()) return;

  // Read on each save, as logout and passcode purges delete the cache from elsewhere
  if (await loadSavedKey(path) === key) return;

  const response = new Response(await buildCss(), {
    headers: { 'Content-Type': 'text/css', [KEY_HEADER]: key },
  });

  await requestPasscodeStateLock(async () => {
    if (await loadPasscodeMeta()) return;

    const cache = await self.caches.open(SNAPSHOT_CACHE_NAME);
    await cache.put(buildSnapshotUrl(path), response);
  });
}

export async function clearCssSnapshot(path: string) {
  if (!self.caches) return;

  const cache = await self.caches.open(SNAPSHOT_CACHE_NAME);
  await cache.delete(buildSnapshotUrl(path));
}

async function loadSavedKey(path: string) {
  const response = await self.caches.match(buildSnapshotUrl(path), { cacheName: SNAPSHOT_CACHE_NAME });
  return response?.headers.get(KEY_HEADER) || undefined;
}

// The URL `index.html` requests, relative to the app root
function buildSnapshotUrl(path: string) {
  return new URL(path, document.baseURI).href;
}
