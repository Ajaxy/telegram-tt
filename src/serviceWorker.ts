import { DEBUG } from './config';
import { respondForProgressive } from './serviceWorker/progressive';
import { respondForDownload } from './serviceWorker/download';
import { respondWithCache, clearAssetCache, respondWithCacheNetworkFirst } from './serviceWorker/assetCache';
import { handlePush, handleNotificationClick, handleClientMessage } from './serviceWorker/pushNotification';
import { pause } from './util/schedulers';

declare const self: ServiceWorkerGlobalScope;

const NETWORK_FIRST_ASSETS = new Set(['/', '/rlottie-wasm.wasm', '/webp_wasm.wasm']);
const RE_CACHE_FIRST_ASSETS = /[\da-f]{20}.*\.(js|css|woff2?|svg|png|jpg|jpeg|tgs|json|wasm)$/;
const ACTIVATE_TIMEOUT = 3000;

self.addEventListener('install', (e) => {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('ServiceWorker installed');
  }

  // Activate worker immediately
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('ServiceWorker activated');
  }

  e.waitUntil(
    Promise.race([
      // An attempt to fix freezing UI on iOS
      pause(ACTIVATE_TIMEOUT),
      Promise.all([
        clearAssetCache(),
        // Become available to all pages
        self.clients.claim(),
      ]),
    ]),
  );
});

self.addEventListener('fetch', (e: FetchEvent) => {
  const { url } = e.request;

  if (url.includes('/progressive/')) {
    e.respondWith(respondForProgressive(e));
    return true;
  }

  if (url.includes('/download/')) {
    e.respondWith(respondForDownload(e));
    return true;
  }

  if (url.startsWith('http')) {
    if (NETWORK_FIRST_ASSETS.has(new URL(url).pathname)) {
      e.respondWith(respondWithCacheNetworkFirst(e));
      return true;
    }

    if (url.match(RE_CACHE_FIRST_ASSETS)) {
      e.respondWith(respondWithCache(e));
      return true;
    }
  }

  return false;
});

self.addEventListener('push', handlePush);
self.addEventListener('notificationclick', handleNotificationClick);
self.addEventListener('message', handleClientMessage);
