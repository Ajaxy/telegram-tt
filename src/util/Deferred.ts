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

  static resolved(): Deferred<void>;
  static resolved<T>(value: T): Deferred<T>;
  static resolved<T>(value?: T): Deferred<T | void> {
    const deferred = new Deferred<T | void>();
    deferred.resolve(value);
    return deferred;
  }
}
