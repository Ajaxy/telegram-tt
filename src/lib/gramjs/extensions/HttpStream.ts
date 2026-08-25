import { concat } from '../../../util/encoding/buffer';

const closeError = new Error('HttpStream was closed');
const REQUEST_TIMEOUT = 10000;

class HttpStreamError extends Error {
  readonly status: number;

  constructor(response: Response) {
    const statusText = response.statusText ? ` ${response.statusText}` : '';
    super(`HttpStream request failed: ${response.status}${statusText}`);
    this.name = 'HttpStreamError';
    this.status = response.status;
  }
}

AbortSignal.timeout ??= function timeout(ms) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
};

export default class HttpStream {
  private url: string | undefined;

  private isClosed: boolean;

  private stream: Uint8Array[] = [];

  private canRead: Promise<void> = Promise.resolve();

  private resolveRead: VoidFunction | undefined;

  private rejectRead: ((reason?: unknown) => void) | undefined;

  private disconnectedCallback: VoidFunction | undefined;

  constructor(disconnectedCallback: VoidFunction) {
    this.isClosed = true;
    this.disconnectedCallback = disconnectedCallback;
  }

  async readExactly(number: number) {
    let readData = new Uint8Array(0);

    while (true) {
      const thisTime = await this.read();
      readData = concat(readData, thisTime);
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

    const response = await fetch(this.url, {
      method: 'POST',
      body: new Uint8Array(0),
      mode: 'cors',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
    if (response.status !== 200) {
      throw new HttpStreamError(response);
    }

    this.isClosed = false;
  }

  write(data: Uint8Array) {
    if (this.isClosed || !this.url) {
      this.handleDisconnect(closeError);
      throw closeError;
    }

    return fetch(this.url, {
      method: 'POST',
      body: new Uint8Array(data),
      mode: 'cors',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    }).then(async (response) => {
      if (this.isClosed) {
        this.handleDisconnect(closeError);
        return;
      }
      if (response.status !== 200) {
        throw new HttpStreamError(response);
      }

      const arrayBuffer = await response.arrayBuffer();

      this.stream = this.stream.concat(new Uint8Array(arrayBuffer));
      if (this.resolveRead && !this.isClosed) this.resolveRead();
    }).catch((err) => {
      this.handleDisconnect(err);
      throw err;
    });
  }

  handleDisconnect(err: unknown) {
    this.disconnectedCallback?.();
    if (this.rejectRead) this.rejectRead(err);
  }

  close() {
    this.isClosed = true;
    this.handleDisconnect(closeError);
    this.disconnectedCallback = undefined;
  }
}
