const Deferred = require('../../../util/Deferred').default;

class RequestState {
    constructor(request, abortSignal = undefined) {
        this.containerId = undefined;
        this.msgId = undefined;
        this.request = request;
        this.data = request.getBytes();
        this.after = undefined;
        this.result = undefined;
        this.abortSignal = abortSignal;
        this.finished = new Deferred();

        this.resetPromise();
    }

    isReady() {
        if (!this.after) {
            return true;
        }

        return this.after.finished.promise;
    }

    resetPromise() {
        // Prevent stuck await
        this.reject?.();

        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

module.exports = RequestState;
