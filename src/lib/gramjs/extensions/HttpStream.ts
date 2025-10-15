const closeError = new Error('HttpStream was closed');
const REQUEST_TIMEOUT = 10000;

AbortSignal.timeout ??= function timeout(ms) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
};

export default class HttpStream {
  private url: string | undefined;

  private isClosed: boolean;

  private stream: Buffer<ArrayBuffer>[] = [];

  private canRead: Promise<void> = Promise.resolve();

  private resolveRead: VoidFunction | undefined;

  private rejectRead: VoidFunction | undefined;

  private disconnectedCallback: VoidFunction | undefined;

  constructor(disconnectedCallback: VoidFunction) {
    this.isClosed = true;
    this.disconnectedCallback = disconnectedCallback;
  }

  async readExactly(number: number) {
    let readData = Buffer.alloc(0);

    while (true) {
      const thisTime = await this.read();
      readData = Buffer.concat([readData, thisTime]);
      number -= thisTime.length;
      if (number <= 0) {
        return readData;
      }
    }
  }

  async read() {
    await this.canRead;

    const data = this.stream.shift()!;
    if (this.stream.length === 0) {
      this.canRead = new Promise((resolve, reject) => {
        this.resolveRead = resolve;
        this.rejectRead = reject;
      });
    }

    return data;
  }

  static getURL(ip: string, port: number, isTestServer?: boolean, isPremium?: boolean) {
    if (port === 443) {
      return `https://${ip}:${port}/apiw1${isTestServer ? '_test' : ''}${isPremium ? '_premium' : ''}`;
    } else {
      return `http://${ip}:${port}/apiw1${isTestServer ? '_test' : ''}${isPremium ? '_premium' : ''}`;
    }
  }

  async connect(port: number, ip: string, isTestServer = false, isPremium = false) {
    this.stream = [];
    this.canRead = new Promise((resolve, reject) => {
      this.resolveRead = resolve;
      this.rejectRead = reject;
    });
    this.url = HttpStream.getURL(ip, port, isTestServer, isPremium);

    await fetch(this.url, {
      method: 'POST',
      body: Buffer.from([]),
      mode: 'cors',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });

    this.isClosed = false;
  }

  write(data: Buffer<ArrayBuffer>) {
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
