export abstract class MTProtoRequest {
    private sent: boolean;

    private sequence: number;

    private msgId: bigint;

    private readonly dirty: boolean;

    private sendTime: number;

    private confirmReceived: boolean;

    private constructorId: number;

    private readonly confirmed: boolean;

    private responded: boolean;

    constructor() {
        this.sent = false;
        this.msgId = 0n; // long
        this.sequence = 0;

        this.dirty = false;
        this.sendTime = 0;
        this.confirmReceived = false;

        // These should be overrode

        this.constructorId = 0;
        this.confirmed = false;
        this.responded = false;
    }

    // These should not be overrode
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
    abstract onSend(): void;

    abstract onResponse(_buffer: Buffer): void;

    abstract onException(_exception: Error): void;
}
