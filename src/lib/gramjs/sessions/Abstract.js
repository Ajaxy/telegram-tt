class Session {
    /**
     * Creates a clone of this session file
     * @param toInstance {Session|null}
     * @returns {Session}
     */

    /* CONTEST
    clone(toInstance = null) {
        return toInstance || new this.constructor()
    } */

    /**
     * Returns the currently-used data center ID.
     */
    get dcId() {
        throw new Error('Not Implemented');
    }

    /**
     * Returns the server address where the library should connect to.
     */
    get serverAddress() {
        throw new Error('Not Implemented');
    }

    /**
     * Returns the port to which the library should connect to.
     */
    get port() {
        throw new Error('Not Implemented');
    }

    /**
     * Returns an ``AuthKey`` instance associated with the saved
     * data center, or `None` if a new one should be generated.
     */
    get authKey() {
        throw new Error('Not Implemented');
    }

    /**
     * Sets the ``AuthKey`` to be used for the saved data center.
     * @param value
     */
    set authKey(value) {
        throw new Error('Not Implemented');
    }

    /**
     * Sets the information of the data center address and port that
     * the library should connect to, as well as the data center ID,
     * which is currently unused.
     * @param dcId {number}
     * @param serverAddress {string}
     * @param port {number}
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setDC(dcId, serverAddress, port) {
        throw new Error('Not implemented');
    }

    /**
     * Returns an ID of the takeout process initialized for this session,
     * or `None` if there's no were any unfinished takeout requests.
     */
    /* CONTEST
    get takeoutId() {
        throw new Error('Not Implemented')
    }
    */
    /**
     * Sets the ID of the unfinished takeout process for this session.
     * @param value
     */
    /* CONTEST
    set takeoutId(value) {
        throw new Error('Not Implemented')
    }
    */
    /**
     * Returns the ``UpdateState`` associated with the given `entity_id`.
     * If the `entity_id` is 0, it should return the ``UpdateState`` for
     * no specific channel (the "general" state). If no state is known
     * it should ``return None``.
     * @param entityId
     */
    /* CONTEST
    getUpdateState(entityId) {
        throw new Error('Not Implemented')
    }

     */

    /**
     * Sets the given ``UpdateState`` for the specified `entity_id`, which
     * should be 0 if the ``UpdateState`` is the "general" state (and not
     * for any specific channel).
     * @param entityId
     * @param state
     */
    /* CONTEST
    setUpdateState(entityId, state) {
        throw new Error('Not Implemented')
    }

     */

    /**
     * Called on client disconnection. Should be used to
     * free any used resources. Can be left empty if none.
     */

    /* CONTEST
    close() {

    }

     */

    /**
     * called whenever important properties change. It should
     * make persist the relevant session information to disk.
     */
    save() {
        throw new Error('Not Implemented');
    }

    /**
     * Called upon client.log_out(). Should delete the stored
     * information from disk since it's not valid anymore.
     */

    delete() {
        throw new Error('Not Implemented');
    }

    /**
     * Lists available sessions. Not used by the library itself.
     */
    /* CONTEST
    listSessions() {
        throw new Error('Not Implemented')
    }

     */

    /**
     * Processes the input ``TLObject`` or ``list`` and saves
     * whatever information is relevant (e.g., ID or access hash).
     * @param tlo
     */
    /* CONTEST
    processEntities(tlo) {
        throw new Error('Not Implemented')
    }

     */

    /**
     * Turns the given key into an ``InputPeer`` (e.g. ``InputPeerUser``).
     * The library uses this method whenever an ``InputPeer`` is needed
     * to suit several purposes (e.g. user only provided its ID or wishes
     * to use a cached username to avoid extra RPC).
     */
    /* CONTEST
    getInputEntity(key) {
        throw new Error('Not Implemented')
    }

     */
}

module.exports = Session;
