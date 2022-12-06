const { Mutex } = require('async-mutex');

const mutex = new Mutex();

const closeError = new Error('WebSocket was closed');

class PromisedWebSockets {
    constructor(disconnectedCallback) {
        /* CONTEST
        this.isBrowser = typeof process === 'undefined' ||
            process.type === 'renderer' ||
            process.browser === true ||
            process.__nwjs

         */
        this.client = undefined;
        this.closed = true;
        this.disconnectedCallback = disconnectedCallback;
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

    getWebSocketLink(ip, port, testServers, isPremium) {
        if (port === 443) {
            return `wss://${ip}:${port}/apiws${testServers ? '_test' : ''}${isPremium ? '_premium' : ''}`;
        } else {
            return `ws://${ip}:${port}/apiws${testServers ? '_test' : ''}${isPremium ? '_premium' : ''}`;
        }
    }

    connect(port, ip, testServers = false, isPremium = false) {
        this.stream = Buffer.alloc(0);
        this.canRead = new Promise((resolve) => {
            this.resolveRead = resolve;
        });
        this.closed = false;
        this.website = this.getWebSocketLink(ip, port, testServers, isPremium);
        this.client = new WebSocket(this.website, 'binary');
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
                if (code !== 1000) {
                    // eslint-disable-next-line no-console
                    console.error(`Socket ${ip} closed. Code: ${code}, reason: ${reason}, was clean: ${wasClean}`);
                }

                this.resolveRead(false);
                this.closed = true;
                if (this.disconnectedCallback) {
                    this.disconnectedCallback();
                }
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
            await mutex.runExclusive(async () => {
                const data = message.data instanceof ArrayBuffer
                    ? Buffer.from(message.data)
                    : Buffer.from(await new Response(message.data).arrayBuffer());
                this.stream = Buffer.concat([this.stream, data]);
                this.resolveRead(true);
            });
        };
    }
}

module.exports = PromisedWebSockets;
