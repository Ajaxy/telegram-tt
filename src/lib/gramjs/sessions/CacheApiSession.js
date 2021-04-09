const StorageSession = require('./StorageSession')

const CACHE_NAME = 'GramJs'

class CacheApiSession extends StorageSession {
    async _fetchFromCache(key) {
        const request = new Request(key)
        const cache = await self.caches.open(CACHE_NAME)
        const cached = await cache.match(request)
        return cached ? cached.text() : null
    }

    async _saveToCache(key, data) {
        const request = new Request(key)
        const response = new Response(data)
        const cache = await self.caches.open(CACHE_NAME)
        return cache.put(request, response)
    }
}

module.exports = CacheApiSession
