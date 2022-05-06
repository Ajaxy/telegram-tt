const Session = require('./Abstract');

class MemorySession extends Session {
    constructor() {
        super();

        this._serverAddress = undefined;
        this._dcId = 0;
        this._port = undefined;
        this._takeoutId = undefined;

        this._entities = new Set();
        this._updateStates = {};
    }

    get dcId() {
        return this._dcId;
    }

    get serverAddress() {
        return this._serverAddress;
    }

    get port() {
        return this._port;
    }

    get authKey() {
        return this._authKey;
    }

    set authKey(value) {
        this._authKey = value;
    }

    setDC(dcId, serverAddress, port) {
        this._dcId = dcId | 0;
        this._serverAddress = serverAddress;
        this._port = port;
    }

    /* CONTEST
    get takeoutId() {
        return this._takeoutId
    }

    set takeoutId(value) {
        this._takeoutId = value
    }

    getUpdateState(entityId) {
        return this._updateStates[entityId]
    }

    setUpdateState(entityId, state) {
        return this._updateStates[entityId] = state
    }

    close() {
    }

    save() {
    }

    async load() {

    }

    delete() {
    }

    _entityValuesToRow(id, hash, username, phone, name) {
        // While this is a simple implementation it might be overrode by,
        // other classes so they don't need to implement the plural form
        // of the method. Don't remove.
        return [id, hash, username, phone, name]
    }

    _entityToRow(e) {
        if (!(e.classType === "constructor")) {
            return
        }
        let p
        let markedId
        try {
            p = utils.getInputPeer(e, false)
            markedId = utils.getPeerId(p)
        } catch (e) {
            // Note: `get_input_peer` already checks for non-zero `accessHash`.
            // See issues #354 and #392. It also checks that the entity
            // is not `min`, because its `accessHash` cannot be used
            // anywhere (since layer 102, there are two access hashes).
            return
        }
        let pHash
        if (p instanceof types.InputPeerUser || p instanceof types.InputPeerChannel) {
            pHash = p.accessHash
        } else if (p instanceof types.InputPeerChat) {
            pHash = 0
        } else {
            return
        }

        let username = e.username
        if (username) {
            username = username.toLowerCase()
        }
        const phone = e.phone
        const name = utils.getDisplayName(e)
        return this._entityValuesToRow(markedId, pHash, username, phone, name)
    }

    _entitiesToRows(tlo) {
        let entities = []
        if (tlo.classType === "constructor" && utils.isListLike(tlo)) {
            // This may be a list of users already for instance
            entities = tlo
        } else {
            if (tlo instanceof Object) {
                if ('user' in tlo) {
                    entities.push(tlo.user)
                }
                if ('chats' in tlo && utils.isListLike(tlo.chats)) {
                    entities.concat(tlo.chats)
                }
                if ('users' in tlo && utils.isListLike(tlo.users)) {
                    entities.concat(tlo.users)
                }
            }
        }
        const rows = [] // Rows to add (id, hash, username, phone, name)
        for (const e of entities) {
            const row = this._entityToRow(e)
            if (row) {
                rows.push(row)
            }
        }
        return rows
    }

    processEntities(tlo) {
        const entitiesSet = this._entitiesToRows(tlo)
        for (const e of entitiesSet) {
            this._entities.add(e)
        }
    }

    getEntityRowsByPhone(phone) {
        for (const e of this._entities) { // id, hash, username, phone, name
            if (e[3] === phone) {
                return [e[0], e[1]]
            }
        }
    }

    getEntityRowsByUsername(username) {
        for (const e of this._entities) { // id, hash, username, phone, name
            if (e[2] === username) {
                return [e[0], e[1]]
            }
        }
    }

    getEntityRowsByName(name) {
        for (const e of this._entities) { // id, hash, username, phone, name
            if (e[4] === name) {
                return [e[0], e[1]]
            }
        }
    }

    getEntityRowsById(id, exact = true) {
        if (exact) {
            for (const e of this._entities) { // id, hash, username, phone, name
                if (e[0] === id) {
                    return [e[0], e[1]]
                }
            }
        } else {
            const ids = [utils.getPeerId(new types.PeerUser({ userId: id })),
                utils.getPeerId(new types.PeerChat({ chatId: id })),
                utils.getPeerId(new types.PeerChannel({ channelId: id })),
            ]
            for (const e of this._entities) { // id, hash, username, phone, name
                if (ids.includes(e[0])) {
                    return [e[0], e[1]]
                }
            }
        }
    }

    getInputEntity(key) {
        let exact
        if (key.SUBCLASS_OF_ID !== undefined) {
            if ([0xc91c90b6, 0xe669bf46, 0x40f202fd].includes(key.SUBCLASS_OF_ID)) {
                // hex(crc32(b'InputPeer', b'InputUser' and b'InputChannel'))
                // We already have an Input version, so nothing else required
                return key
            }
            // Try to early return if this key can be casted as input peer
            return utils.getInputPeer(key)
        } else {
            // Not a TLObject or can't be cast into InputPeer
            if (key.classType === 'constructor') {
                key = utils.getPeerId(key)
                exact = true
            } else {
                exact = !(typeof key == 'number') || key < 0
            }
        }
        let result = null
        if (typeof key === 'string') {
            const phone = utils.parsePhone(key)
            if (phone) {
                result = this.getEntityRowsByPhone(phone)
            } else {
                const { username, isInvite } = utils.parseUsername(key)
                if (username && !isInvite) {
                    result = this.getEntityRowsByUsername(username)
                } else {
                    const tup = utils.resolveInviteLink(key)[1]
                    if (tup) {
                        result = this.getEntityRowsById(tup, false)
                    }
                }
            }
        } else if (typeof key === 'number') {
            result = this.getEntityRowsById(key, exact)
        }
        if (!result && typeof key === 'string') {
            result = this.getEntityRowsByName(key)
        }

        if (result) {
            let entityId = result[0] // unpack resulting tuple
            const entityHash = result[1]
            const resolved = utils.resolveId(entityId)
            entityId = resolved[0]
            const kind = resolved[1]
            // removes the mark and returns type of entity
            if (kind === types.PeerUser) {
                return new types.InputPeerUser({ userId: entityId, accessHash: entityHash })
            } else if (kind === types.PeerChat) {
                return new types.InputPeerChat({ chatId: entityId })
            } else if (kind === types.PeerChannel) {
                return new types.InputPeerChannel({ channelId: entityId, accessHash: entityHash })
            }
        } else {
            throw new Error('Could not find input entity with key ' + key)
        }
    } */
}

module.exports = MemorySession;
