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

    if (url.startsWith('http') && url.match(ASSET_CACHE_PATTERN)) {
      return respondWithCache(e);
    }

    return fetch(e.request);
  })());
});


self.addEventListener('push', (e: PushEvent) => {
  if (DEBUG) {
    // eslint-disable-next-line no-console
    console.log('[SW] Push received event', e);
    if (e.data) {
      // eslint-disable-next-line no-console
      console.log(`[SW] Push received with data "${e.data.text()}"`);
    }
  }
  if (!e.data) return;
  let obj;
  try {
    obj = e.data.json();
  } catch (error) {
    obj = e.data.text();
  }

  const title = obj.title || 'Telegram';
  const body = obj.description || obj;
  const options = {
    body,
    icon: 'android-chrome-192x192.png',
  };

  e.waitUntil(
    self.registration.showNotification(title, options),
  );
});

self.addEventListener('notificationclick', (event) => {
  const url = '/';
  event.notification.close(); // Android needs explicit close.
  event.waitUntil(
    self.clients.matchAll({ type: 'window' })
      .then((windowClients) => {
        // Check if there is already a window/tab open with the target URL
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i] as WindowClient;
          // If so, just focus it.
          if (client.url === url && client.focus) {
            client.focus();
            return;
          }
        }
        // If not, then open the target URL in a new window/tab.
        if (self.clients.openWindow) {
          self.clients.openWindow(url);
        }
      }),
  );
});
