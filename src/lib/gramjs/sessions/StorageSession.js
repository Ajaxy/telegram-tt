const MemorySession = require('./Memory')
const AuthKey = require('../crypto/AuthKey')
const utils = require('../Utils')

const STORAGE_KEY_BASE = 'GramJs-session-'

class StorageSession extends MemorySession {
    constructor(sessionId) {
        super()
        this._storageKey = sessionId
        this._authKeys = {}
    }

    async load() {
        if (!this._storageKey) {
            return
        }

        try {
            const json = await this._fetchFromCache()
            const { mainDcId, keys, hashes } = JSON.parse(json)
            const { ipAddress, port } = utils.getDC(mainDcId)

            this.setDC(mainDcId, ipAddress, port, true)

            Object.keys(keys).forEach((dcId) => {
                if (keys[dcId] && hashes[dcId]){
                    this._authKeys[dcId] = new AuthKey(
                        Buffer.from(keys[dcId].data),
                        Buffer.from(hashes[dcId].data)
                    )
                }
            })
        } catch (err) {
            throw new Error(`Failed to retrieve or parse JSON from Cache for key ${this._storageKey}`)
        }
    }

    setDC(dcId, serverAddress, port, skipUpdateStorage = false) {
        this._dcId = dcId
        this._serverAddress = serverAddress
        this._port = port

        delete this._authKeys[dcId]

        if (!skipUpdateStorage) {
            void this._updateStorage()
        }
    }

    async save() {
        if (!this._storageKey) {
            this._storageKey = generateStorageKey()
        }

        await this._updateStorage()

        return this._storageKey
    }

    get authKey() {
        throw new Error('Not supported')
    }

    set authKey(value) {
        throw new Error('Not supported')
    }

    getAuthKey(dcId = this._dcId) {
        return this._authKeys[dcId]
    }

    setAuthKey(authKey, dcId = this._dcId) {
        this._authKeys[dcId] = authKey

        void this._updateStorage()
    }

    async _updateStorage() {
        if (!this._storageKey) {
            return
        }

        const sessionData = {
            mainDcId: this._dcId,
            keys: {},
            hashes: {}
        }

        Object.keys(this._authKeys).map((dcId) => {
            const authKey = this._authKeys[dcId]
            sessionData.keys[dcId] = authKey._key
            sessionData.hashes[dcId] = authKey._hash
        })

        await this._saveToCache(JSON.stringify(sessionData))
    }

    async delete() {
        throw new Error('Not Implemented')
    }

    async _fetchFromCache() {
        throw new Error('Not Implemented')
    }

    async _saveToCache(data) {
        throw new Error('Not Implemented')
    }
}

function generateStorageKey() {
    // Creating two sessions at the same moment is not expected nor supported.
    return `${STORAGE_KEY_BASE}${Date.now()}`
}

module.exports = StorageSession
