export default class AsyncQueue<T extends unknown> {
    private _queue: T[];

    private canGet: Promise<boolean>;

    private resolveGet: (value: boolean) => void;

    private canPush: Promise<boolean> | boolean;

    private resolvePush: (value: boolean) => void;

    constructor() {
        this._queue = [];
        this.resolvePush = () => {};
        this.resolveGet = () => {};
        this.canGet = new Promise((resolve) => {
            this.resolveGet = resolve;
        });
        this.canPush = true;
    }

    async push(value: T) {
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
