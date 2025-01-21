import { Mutex } from "async-mutex";

const mutex = new Mutex();

const closeError = new Error('WebSocket was closed');
const CONNECTION_TIMEOUT = 3000;
const MAX_TIMEOUT = 30000;

export default class PromisedWebSockets {
    private closed: boolean;

    private timeout: number;

    private stream: Buffer;

    private canRead?: boolean | Promise<boolean>;

    private resolveRead: ((value?: any) => void) | undefined;

    private client: WebSocket | undefined;

    private website?: string;

    private disconnectedCallback: () => void;

    constructor(disconnectedCallback: () => void) {
        this.client = undefined;
        this.closed = true;
        this.stream = Buffer.alloc(0);
        this.disconnectedCallback = disconnectedCallback;
        this.timeout = CONNECTION_TIMEOUT;
    }

    async readExactly(number: number) {
        let readData = Buffer.alloc(0);
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const thisTime = await this.read(number);
            readData = Buffer.concat([readData, thisTime]);
            number -= thisTime.length;
            if (!number) {
                return readData;
            }
        }
    }

    async read(number: number) {
        if (this.closed) {
            throw closeError;
        }
        await this.canRead;
        if (this.closed) {
            throw closeError;
        }
        const toReturn = this.stream.slice(0, number);
        this.stream = this.stream.slice(number);
        if (this.stream.length === 0) {
            this.canRead = new Promise((resolve) => {
                this.resolveRead = resolve;
            });
        }

        return toReturn;
    }

    async readAll() {
        if (this.closed || !await this.canRead) {
            throw closeError;
        }
        const toReturn = this.stream;
        this.stream = Buffer.alloc(0);
        this.canRead = new Promise((resolve) => {
            this.resolveRead = resolve;
        });

        return toReturn;
    }

    getWebSocketLink(ip: string, port: number, isTestServer?: boolean, isPremium?: boolean) {
        if (port === 443) {
            return `wss://${ip}:${port}/apiws${isTestServer ? '_test' : ''}${isPremium ? '_premium' : ''}`;
        } else {
            return `ws://${ip}:${port}/apiws${isTestServer ? '_test' : ''}${isPremium ? '_premium' : ''}`;
        }
    }

    connect(port: number, ip: string, isTestServer = false, isPremium = false) {
        this.stream = Buffer.alloc(0);
        this.canRead = new Promise((resolve) => {
            this.resolveRead = resolve;
        });
        this.closed = false;
        this.website = this.getWebSocketLink(ip, port, isTestServer, isPremium);
        this.client = new WebSocket(this.website, 'binary');
        return new Promise((resolve, reject) => {
            if (!this.client) return;
            let hasResolved = false;
            let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
            this.client.onopen = () => {
                this.receive();
                resolve(this);
                hasResolved = true;
                if (timeout) clearTimeout(timeout);
            };
            this.client.onerror = (error) => {
                // eslint-disable-next-line no-console
                console.error('WebSocket error', error);
                reject(error);
                hasResolved = true;
                if (timeout) clearTimeout(timeout);
            };
            this.client.onclose = (event) => {
                const { code, reason, wasClean } = event;
                if (code !== 1000) {
                    // eslint-disable-next-line no-console
                    console.error(`Socket ${ip} closed. Code: ${code}, reason: ${reason}, was clean: ${wasClean}`);
                }

                this.resolveRead?.(false);
                this.closed = true;
                if (this.disconnectedCallback) {
                    this.disconnectedCallback();
                }
                hasResolved = true;
                if (timeout) clearTimeout(timeout);
            };

            timeout = setTimeout(() => {
                if (hasResolved) return;

                reject(new Error('WebSocket connection timeout'));
                this.resolveRead?.(false);
                this.closed = true;
                if (this.disconnectedCallback) {
                    this.disconnectedCallback();
                }
                this.client?.close();
                this.timeout *= 2;
                this.timeout = Math.min(this.timeout, MAX_TIMEOUT);
                timeout = undefined;
            }, this.timeout);

            // CONTEST
            // Seems to not be working, at least in a web worker
            // eslint-disable-next-line no-restricted-globals
            self.addEventListener('offline', async () => {
                await this.close();
                this.resolveRead?.(false);
            });
        });
    }

    write(data: Buffer) {
        if (this.closed) {
            throw closeError;
        }
        this.client?.send(data);
    }

    async close() {
        await this.client?.close();
        this.closed = true;
    }

    receive() {
        if (!this.client) return;
        this.client.onmessage = async (message) => {
            await mutex.runExclusive(async () => {
                const data = message.data instanceof ArrayBuffer
                    ? Buffer.from(message.data)
                    : Buffer.from(await new Response(message.data).arrayBuffer());
                this.stream = Buffer.concat([this.stream, data]);
                this.resolveRead?.(true);
            });
        };
    }
}
