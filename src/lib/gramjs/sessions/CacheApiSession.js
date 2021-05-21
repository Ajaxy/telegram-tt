/* eslint-disable no-restricted-globals */
const StorageSession = require('./StorageSession');

const CACHE_NAME = 'GramJs';

class CacheApiSession extends StorageSession {
    async _delete() {
        const request = new Request(this._storageKey);
        const cache = await self.caches.open(CACHE_NAME);
        return cache.delete(request);
    }

    async _fetchFromCache() {
        const request = new Request(this._storageKey);
        const cache = await self.caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        return cached ? cached.text() : undefined;
    }

    async _saveToCache(data) {
        const request = new Request(this._storageKey);
        const response = new Response(data);
        const cache = await self.caches.open(CACHE_NAME);
        return cache.put(request, response);
    }
}

module.exports = CacheApiSession;
