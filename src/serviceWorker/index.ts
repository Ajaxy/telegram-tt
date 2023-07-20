import { DEBUG, ELECTRON_HOST_URL, IS_ELECTRON } from '../config';
import { respondForProgressive } from './progressive';
import { respondForDownload } from './download';
import { respondWithCache, clearAssetCache, respondWithCacheNetworkFirst } from './assetCache';
import {
  handlePush,
  handleNotificationClick,
  handleClientMessage as handleNotificationMessage,
} from './pushNotification';
import { respondForShare, handleClientMessage as handleShareMessage } from './share';

import { pause } from '../util/schedulers';

declare const self: ServiceWorkerGlobalScope;

const RE_NETWORK_FIRST_ASSETS = /\.(wasm|html)$/;
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
  const scope = IS_ELECTRON ? ELECTRON_HOST_URL : self.registration.scope;
  if (!url.startsWith(scope)) {
    return false;
  }

  const { pathname, protocol } = new URL(url);
  const { pathname: scopePathname } = new URL(scope);

  if (pathname.includes('/progressive/')) {
    e.respondWith(respondForProgressive(e));
    return true;
  }

  if (pathname.includes('/download/')) {
    e.respondWith(respondForDownload(e));
    return true;
  }

  if (pathname.includes('/share/')) {
    e.respondWith(respondForShare(e));
  }

  if (protocol === 'http:' || protocol === 'https:') {
    if (pathname === scopePathname || pathname.match(RE_NETWORK_FIRST_ASSETS)) {
      e.respondWith(respondWithCacheNetworkFirst(e));
      return true;
    }

    if (pathname.match(RE_CACHE_FIRST_ASSETS)) {
      e.respondWith(respondWithCache(e));
      return true;
    }
  }

  return false;
});

self.addEventListener('push', handlePush);
self.addEventListener('notificationclick', handleNotificationClick);
self.addEventListener('message', (event) => {
  handleNotificationMessage(event);
  handleShareMessage(event);
});
