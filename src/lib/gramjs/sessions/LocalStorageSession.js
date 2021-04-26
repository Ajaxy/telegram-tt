const StorageSession = require('./StorageSession')

class LocalStorageSession extends StorageSession {
    async delete() {
        return localStorage.removeItem(this._storageKey)
    }

    async _fetchFromCache(key) {
        return localStorage.getItem(this._storageKey)
    }

    async _saveToCache(key, data) {
        return localStorage.setItem(this._storageKey, data)
    }
}

module.exports = LocalStorageSession
