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
        this.sendTime = Date.now();
        this.sent = true;
    }

    onConfirm() {
        this.confirmReceived = true;
    }

    needResend() {
        return this.dirty || (this.confirmed && !this.confirmReceived && Date.now() - this.sendTime > 3000);
    }

    // These should be overrode
    onSend() {
        throw Error(`Not overload ${this.constructor.name}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onResponse(buffer) {
        throw Error(`Not overload ${this.constructor.name}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onException(exception) {
        throw Error(`Not overload ${this.constructor.name}`);
    }
}

module.exports = MTProtoRequest;
