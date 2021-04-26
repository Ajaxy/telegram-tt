const StorageSession = require('./StorageSession')

const CACHE_NAME = 'GramJs'

class CacheApiSession extends StorageSession {
    async delete() {
        const request = new Request(this._storageKey)
        const cache = await self.caches.open(CACHE_NAME)
        await cache.delete(request)
    }

    async _fetchFromCache() {
        const request = new Request(this._storageKey)
        const cache = await self.caches.open(CACHE_NAME)
        const cached = await cache.match(request)
        return cached ? cached.text() : null
    }

    async _saveToCache(data) {
        const request = new Request(this._storageKey)
        const response = new Response(data)
        const cache = await self.caches.open(CACHE_NAME)
        return cache.put(request, response)
    }
}

module.exports = CacheApiSession
