class PendingState {
    constructor() {
        this._pending = new Map();
    }

    set(msgId, state) {
        this._pending.set(msgId.toString(), state);
    }

    get(msgId) {
        return this._pending.get(msgId.toString());
    }

    getAndDelete(msgId) {
        const state = this.get(msgId);
        this.delete(msgId);
        return state;
    }

    values() {
        return Array.from(this._pending.values());
    }

    delete(msgId) {
        this._pending.delete(msgId.toString());
    }

    clear() {
        this._pending.clear();
    }
}

module.exports = PendingState;
