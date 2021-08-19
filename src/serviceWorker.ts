import { DEBUG } from './config';
import { respondForProgressive } from './serviceWorker/progressive';
import { respondWithCache, clearAssetCache } from './serviceWorker/assetCache';
import { handlePush, handleNotificationClick, handleClientMessage } from './serviceWorker/pushNotification';

declare const self: ServiceWorkerGlobalScope;

const ASSET_CACHE_PATTERN = /[0-9a-f]{20}.*\.(js|css|woff2?|svg|png|jpg|jpeg|json|wasm)$/;

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

  e.waitUntil(clearAssetCache());
  // Become available to all pages
  e.waitUntil(self.clients.claim());
});

// eslint-disable-next-line no-restricted-globals
self.addEventListener('fetch', (e: FetchEvent) => {
  const { url } = e.request;

  if (url.includes('/progressive/')) {
    e.respondWith(respondForProgressive(e));
    return true;
  }

  if (url.startsWith('http') && url.match(ASSET_CACHE_PATTERN)) {
    e.respondWith(respondWithCache(e));
    return true;
  }

  return false;
});

self.addEventListener('push', handlePush);
self.addEventListener('notificationclick', handleNotificationClick);
self.addEventListener('message', handleClientMessage);
