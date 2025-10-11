import type RequestState from '../network/RequestState';

export default class PendingState {
  _pending: Map<bigint, RequestState>;

  constructor() {
    this._pending = new Map();
  }

  set(msgId: bigint, state: RequestState) {
    this._pending.set(msgId, state);
  }

  get(msgId: bigint) {
    return this._pending.get(msgId);
  }

  getAndDelete(msgId: bigint) {
    const state = this.get(msgId);
    this.delete(msgId);
    return state;
  }

  values() {
    return Array.from(this._pending.values());
  }

  delete(msgId: bigint) {
    return this._pending.delete(msgId);
  }

  clear() {
    this._pending.clear();
  }
}
