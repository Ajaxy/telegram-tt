import type BigInt from 'big-integer';

import type RequestState from '../network/RequestState';

export default class PendingState {
    _pending: Map<string, RequestState>;

    constructor() {
        this._pending = new Map();
    }

    set(msgId: BigInt.BigInteger, state: RequestState) {
        this._pending.set(msgId.toString(), state);
    }

    get(msgId: BigInt.BigInteger) {
        return this._pending.get(msgId.toString());
    }

    getAndDelete(msgId: BigInt.BigInteger) {
        const state = this.get(msgId);
        this.delete(msgId);
        return state;
    }

    values() {
        return Array.from(this._pending.values());
    }

    delete(msgId: BigInt.BigInteger) {
        this._pending.delete(msgId.toString());
    }

    clear() {
        this._pending.clear();
    }
}
