class RequestState {
    constructor(request, after = null) {
        this.containerId = null;
        this.msgId = null;
        this.request = request;
        this.data = request.getBytes();
        this.after = after;
        this.result = null;
        this.promise = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }
}

module.exports = RequestState;
