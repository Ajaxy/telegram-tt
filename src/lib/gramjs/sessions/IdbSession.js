const StorageSession = require('./StorageSession')
const idb = require('idb-keyval')

const CACHE_NAME = 'GramJs'

class IdbSession extends StorageSession {
    async delete() {
        return idb.del(`${CACHE_NAME}:${this._storageKey}`)
    }

    async _fetchFromCache() {
        return idb.get(`${CACHE_NAME}:${this._storageKey}`)
    }

    async _saveToCache(data) {
        return idb.set(`${CACHE_NAME}:${this._storageKey}`, data)
    }
}

module.exports = IdbSession
