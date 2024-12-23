import Deferred from './Deferred';

export class Foreman {
  private deferreds: Deferred[] = [];

  private priorityDeferreds: Deferred[] = [];

  activeWorkers = 0;

  constructor(private maxWorkers: number) {
  }

  requestWorker(isPriority?: boolean) {
    if (this.activeWorkers === this.maxWorkers) {
      const deferred = new Deferred();
      if (isPriority) {
        this.priorityDeferreds.push(deferred);
      } else {
        this.deferreds.push(deferred);
      }
      return deferred.promise;
    }

    this.activeWorkers++;
    return Promise.resolve();
  }

  releaseWorker() {
    if (this.queueLength) {
      const deferred = (this.priorityDeferreds.shift() || this.deferreds.shift())!;
      deferred.resolve();
    } else {
      this.activeWorkers--;
    }
  }

  get queueLength() {
    return this.deferreds.length + this.priorityDeferreds.length;
  }
}
