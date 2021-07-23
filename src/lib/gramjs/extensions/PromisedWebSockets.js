const { Mutex } = require('async-mutex');

const mutex = new Mutex();

const WebSocketClient = require('websocket').w3cwebsocket;

const closeError = new Error('WebSocket was closed');

class PromisedWebSockets {
    constructor() {
        /* CONTEST
        this.isBrowser = typeof process === 'undefined' ||
            process.type === 'renderer' ||
            process.browser === true ||
            process.__nwjs

         */
        this.client = undefined;
        this.closed = true;
    }

    async readExactly(number) {
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

    async read(number) {
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

    getWebSocketLink(ip, port) {
        if (port === 443) {
            return `wss://${ip}:${port}/apiws`;
        } else {
            return `ws://${ip}:${port}/apiws`;
        }
    }

    connect(port, ip) {
        this.stream = Buffer.alloc(0);
        this.canRead = new Promise((resolve) => {
            this.resolveRead = resolve;
        });
        this.closed = false;
        this.website = this.getWebSocketLink(ip, port);
        this.client = new WebSocketClient(this.website, 'binary');
        return new Promise((resolve, reject) => {
            this.client.onopen = () => {
                this.receive();
                resolve(this);
            };
            this.client.onerror = (error) => {
                // eslint-disable-next-line no-console
                console.error('WebSocket error', error);
                reject(error);
            };
            this.client.onclose = (event) => {
                const { code, reason, wasClean } = event;
                // eslint-disable-next-line no-console
                console.error(`Socket ${ip} closed. Code: ${code}, reason: ${reason}, was clean: ${wasClean}`);
                this.resolveRead(false);
                this.closed = true;
            };
            // CONTEST
            // Seems to not be working, at least in a web worker
            // eslint-disable-next-line no-restricted-globals
            self.addEventListener('offline', async () => {
                await this.close();
                this.resolveRead(false);
            });
        });
    }

    write(data) {
        if (this.closed) {
            throw closeError;
        }
        this.client.send(data);
    }

    async close() {
        await this.client.close();
        this.closed = true;
    }

    receive() {
        this.client.onmessage = async (message) => {
            const release = await mutex.acquire();
            try {
                const data = message.data instanceof ArrayBuffer
                    ? Buffer.from(message.data)
                    : Buffer.from(await new Response(message.data).arrayBuffer());
                this.stream = Buffer.concat([this.stream, data]);
                this.resolveRead(true);
            } finally {
                release();
            }
        };
    }
}

module.exports = PromisedWebSockets;
