class AsyncQueue {
    constructor() {
        this._queue = [];
        this.canGet = new Promise((resolve) => {
            this.resolveGet = resolve;
        });
        this.canPush = true;
    }

    async push(value) {
        await this.canPush;
        this._queue.push(value);
        this.resolveGet(true);
        this.canPush = new Promise((resolve) => {
            this.resolvePush = resolve;
        });
    }

    async pop() {
        await this.canGet;
        const returned = this._queue.pop();
        this.resolvePush(true);
        this.canGet = new Promise((resolve) => {
            this.resolveGet = resolve;
        });
        return returned;
    }
}

module.exports = AsyncQueue;
