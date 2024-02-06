const closeError = new Error('HttpStream was closed');
const REQUEST_TIMEOUT = 10000;

AbortSignal.timeout ??= function timeout(ms) {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), ms);
    return ctrl.signal;
};

class HttpStream {
    private url: string | undefined;

    private isClosed: boolean;

    private stream: Buffer[] = [];

    private canRead: Promise<void> = Promise.resolve();

    private resolveRead: VoidFunction | undefined;

    private rejectRead: VoidFunction | undefined;

    private disconnectedCallback: VoidFunction | undefined;

    constructor(disconnectedCallback: VoidFunction) {
        this.isClosed = true;
        this.disconnectedCallback = disconnectedCallback;
    }

    async read() {
        await this.canRead;

        const data = this.stream.shift();
        if (this.stream.length === 0) {
            this.canRead = new Promise((resolve, reject) => {
                this.resolveRead = resolve;
                this.rejectRead = reject;
            });
        }

        return data;
    }

    static getURL(ip: string, port: number, testServers: boolean, isPremium: boolean) {
        if (port === 443) {
            return `https://${ip}:${port}/apiw1${testServers ? '_test' : ''}${isPremium ? '_premium' : ''}`;
        } else {
            return `http://${ip}:${port}/apiw1${testServers ? '_test' : ''}${isPremium ? '_premium' : ''}`;
        }
    }

    async connect(port: number, ip: string, testServers = false, isPremium = false) {
        this.stream = [];
        this.canRead = new Promise((resolve, reject) => {
            this.resolveRead = resolve;
            this.rejectRead = reject;
        });
        this.url = HttpStream.getURL(ip, port, testServers, isPremium);

        await fetch(this.url, {
            method: 'POST',
            body: Buffer.from([]),
            mode: 'cors',
            signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        });

        this.isClosed = false;
    }

    write(data: Buffer) {
        if (this.isClosed || !this.url) {
            this.handleDisconnect();
            throw closeError;
        }

        return fetch(this.url, {
            method: 'POST',
            body: data,
            mode: 'cors',
            signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        }).then(async (response) => {
            if (this.isClosed) {
                this.handleDisconnect();
                return;
            }
            if (response.status !== 200) {
                throw closeError;
            }

            const arrayBuffer = await response.arrayBuffer();

            this.stream = this.stream.concat(Buffer.from(arrayBuffer));
            if (this.resolveRead && !this.isClosed) this.resolveRead();
        }).catch((err) => {
            this.handleDisconnect();
            throw err;
        });
    }

    handleDisconnect() {
        this.disconnectedCallback?.();
        if (this.rejectRead) this.rejectRead();
    }

    close() {
        this.isClosed = true;
        this.handleDisconnect();
        this.disconnectedCallback = undefined;
    }
}

export default HttpStream;
