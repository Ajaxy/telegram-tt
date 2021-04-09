const StorageSession = require('./StorageSession')

class LocalStorageSession extends StorageSession {
    async _fetchFromCache(key) {
        return localStorage.getItem(key);
    }

    async _saveToCache(key, data) {
        return localStorage.setItem(key, data);
    }
}

module.exports = LocalStorageSession
