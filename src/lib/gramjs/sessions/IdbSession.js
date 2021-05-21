const idb = require('idb-keyval');
const StorageSession = require('./StorageSession');

const CACHE_NAME = 'GramJs';

class IdbSession extends StorageSession {
    _delete() {
        return idb.del(`${CACHE_NAME}:${this._storageKey}`);
    }

    _fetchFromCache() {
        return idb.get(`${CACHE_NAME}:${this._storageKey}`);
    }

    _saveToCache(data) {
        return idb.set(`${CACHE_NAME}:${this._storageKey}`, data);
    }
}

module.exports = IdbSession;
