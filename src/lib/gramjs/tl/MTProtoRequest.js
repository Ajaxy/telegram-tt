class MTProtoRequest {
    constructor() {
        this.sent = false;
        this.msgId = 0; // long
        this.sequence = 0;

        this.dirty = false;
        this.sendTime = 0;
        this.confirmReceived = false;

        // These should be overrode

        this.constructorId = 0;
        this.confirmed = false;
        this.responded = false;
    }

    // these should not be overrode
    onSendSuccess() {
        this.sendTime = new Date().getTime();
        this.sent = true;
    }

    onConfirm() {
        this.confirmReceived = true;
    }

    needResend() {
        return this.dirty || (this.confirmed && !this.confirmReceived && new Date().getTime() - this.sendTime > 3000);
    }

    // These should be overrode
    onSend() {
        throw Error('Not overload ' + this.constructor.name);
    }

    onResponse(buffer) {
    }

    onException(exception) {
    }
}

module.exports = MTProtoRequest;
