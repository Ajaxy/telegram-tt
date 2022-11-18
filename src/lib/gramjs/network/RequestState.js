const { default: Deferred } = require('../../../util/Deferred');

class RequestState {
    constructor(request, after = undefined, pending = {}) {
        this.containerId = undefined;
        this.msgId = undefined;
        this.request = request;
        this.data = request.getBytes();
        this.after = after;
        this.result = undefined;
        this.pending = pending;
        this.deferred = new Deferred();
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }

    isReady() {
        const state = this.pending[this.after.id];
        if (!state) {
            return true;
        }
        return state.deferred.promise;
    }
}

module.exports = RequestState;
