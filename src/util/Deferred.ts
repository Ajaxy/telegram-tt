export default class Deferred<T = void> {
  promise: Promise<T>;

  reject!: (reason?: any) => void;

  resolve!: (value: T | PromiseLike<T>) => void;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.reject = reject;
      this.resolve = resolve;
    });
  }
}
