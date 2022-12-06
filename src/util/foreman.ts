import Deferred from './Deferred';

export class Foreman {
  private deferreds: Deferred[] = [];

  activeWorkers = 0;

  constructor(private maxWorkers: number) {
  }

  requestWorker() {
    if (this.activeWorkers === this.maxWorkers) {
      const deferred = new Deferred();
      this.deferreds.push(deferred);
      return deferred.promise;
    } else {
      this.activeWorkers++;
    }

    return Promise.resolve();
  }

  releaseWorker() {
    if (this.deferreds.length && (this.activeWorkers === this.maxWorkers)) {
      const deferred = this.deferreds.shift()!;
      deferred.resolve();
    } else {
      this.activeWorkers--;
    }
  }
}
