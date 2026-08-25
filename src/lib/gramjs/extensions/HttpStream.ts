import { concat } from '../../../util/encoding/buffer';

const closeError = new Error('HttpStream was closed');
const REQUEST_TIMEOUT = 30000;

export class HttpStreamError extends Error {
  readonly status: number;

  constructor(response: Response) {
    const statusText = response.statusText ? ` ${response.statusText}` : '';
    super(`HttpStream request failed: ${response.status}${statusText}`);
    this.name = 'HttpStreamError';
    this.status = response.status;
  }
}

export default class HttpStream {
  private url: string | undefined;

  private isClosed: boolean;

  private abortController?: AbortController;

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
      void this.canRead.catch(() => undefined);
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

  connect(port: number, ip: string, isTestServer = false, isPremium = false) {
    this.abortController?.abort();
    this.abortController = new AbortController();
    this.stream = [];
    this.canRead = new Promise((resolve, reject) => {
      this.resolveRead = resolve;
      this.rejectRead = reject;
    });
    void this.canRead.catch(() => undefined);
    this.url = HttpStream.getURL(ip, port, isTestServer, isPremium);
    this.isClosed = false;

    return Promise.resolve();
  }

  write(data: Uint8Array) {
    if (this.isClosed || !this.url || !this.abortController) {
      this.handleDisconnect(closeError);
      throw closeError;
    }

    const abortController = this.abortController;
    const requestTimeout = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT);

    return fetch(this.url, {
      method: 'POST',
      body: new Uint8Array(data),
      mode: 'cors',
      signal: abortController.signal,
    }).then(async (response) => {
      if (this.abortController !== abortController) throw closeError;
      if (this.isClosed) {
        this.handleDisconnect(closeError);
        return;
      }
      if (response.status !== 200) {
        throw new HttpStreamError(response);
      }

      const arrayBuffer = await response.arrayBuffer();
      if (this.abortController !== abortController) throw closeError;
      if (!arrayBuffer.byteLength) {
        throw new Error('HttpStream received an empty response');
      }

      this.stream = this.stream.concat(new Uint8Array(arrayBuffer));
      if (this.resolveRead && !this.isClosed) this.resolveRead();
    }).catch((err) => {
      if (this.abortController === abortController) this.handleDisconnect(err);
      throw err;
    }).finally(() => {
      clearTimeout(requestTimeout);
    });
  }

  handleDisconnect(err: unknown) {
    this.abortController?.abort();
    this.disconnectedCallback?.();
    if (this.rejectRead) this.rejectRead(err);
  }

  close() {
    this.isClosed = true;
    this.abortController?.abort();
    this.abortController = undefined;
    this.handleDisconnect(closeError);
    this.disconnectedCallback = undefined;
  }
}
