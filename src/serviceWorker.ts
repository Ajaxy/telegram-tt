import { DEBUG } from './config';
import { respondForProgressive } from './serviceWorker/progressive';
import { respondWithCache, clearAssetCache } from './serviceWorker/assetCache';

declare const self: ServiceWorkerGlobalScope;

const ASSET_CACHE_PATTERN = /[0-9a-f]{20}.*\.(js|css|woff2?|svg|png|jpg|json|wasm)$/;

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

  // Become available to all pages
  e.waitUntil(clearAssetCache());
  e.waitUntil(self.clients.claim());
});

// eslint-disable-next-line no-restricted-globals
self.addEventListener('fetch', (e: FetchEvent) => {
  e.respondWith((() => {
    const { url } = e.request;

    if (url.includes('/progressive/')) {
      return respondForProgressive(e);
    }

    if (url.match(ASSET_CACHE_PATTERN)) {
      return respondWithCache(e);
    }

    return fetch(e.request);
  })());
});
