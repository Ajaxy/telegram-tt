import { DEBUG } from '../config';

import Deferred from './Deferred';

const MAX_CONCURRENT_CONNECTIONS = 3;
const MAX_CONCURRENT_CONNECTIONS_PREMIUM = 6;

const MAX_ACTIVE_REQUEST_SIZE = 9 * 1024 * 1024;
const MAX_ACTIVE_REQUEST_SIZE_PREMIUM = 20 * 1024 * 1024;

const FOREMAN_MAX_HEAP_SIZE = MAX_ACTIVE_REQUEST_SIZE_PREMIUM / MAX_CONCURRENT_CONNECTIONS_PREMIUM;

interface QueuedRequest {
  deferred: Deferred;
  requestSize: number;
}

const dcManagers: Record<number, DcBandwidthManager> = {};

export function getDcBandwidthManager(dcId: number, isPremium: boolean): DcBandwidthManager {
  if (!dcManagers[dcId]) {
    dcManagers[dcId] = new DcBandwidthManager();
  }
  const dcManager = dcManagers[dcId];
  dcManager.updateIsPremium(isPremium);
  return dcManager;
}

if (DEBUG) {
  (globalThis as any).getDcManagers = () => dcManagers;
}

class Foreman {
  private queuedRequests: QueuedRequest[] = [];
  private priorityQueuedRequests: QueuedRequest[] = [];

  activeRequestHeapSize = 0;
  queuedRequestHeapSize = 0;

  constructor(private maxRequestHeapSize: number) { }

  requestWorker(requestSize: number, isPriority?: boolean) {
    if (this.activeRequestHeapSize + requestSize > this.maxRequestHeapSize) {
      const deferred = new Deferred();
      const queuedRequest = { deferred, requestSize };
      if (isPriority) {
        this.priorityQueuedRequests.push(queuedRequest);
      } else {
        this.queuedRequests.push(queuedRequest);
      }
      this.queuedRequestHeapSize += requestSize;
      return deferred.promise;
    }

    this.activeRequestHeapSize += requestSize;
    return Promise.resolve();
  }

  releaseWorker(requestSize: number) {
    this.activeRequestHeapSize -= requestSize;

    // Try to process queued requests
    while (this.queueLength > 0) {
      const queuedRequest = this.priorityQueuedRequests[0] || this.queuedRequests[0];
      if (!queuedRequest) break;

      // Check if we can process the next queued request
      if (this.activeRequestHeapSize + queuedRequest.requestSize <= this.maxRequestHeapSize) {
        const request = (this.priorityQueuedRequests.shift() || this.queuedRequests.shift())!;
        this.queuedRequestHeapSize -= request.requestSize;
        this.activeRequestHeapSize += request.requestSize;
        request.deferred.resolve();
      } else {
        break;
      }
    }
  }

  canAccept(requestSize: number) {
    return this.activeRequestHeapSize + requestSize <= this.maxRequestHeapSize;
  }

  get queueLength() {
    return this.queuedRequests.length + this.priorityQueuedRequests.length;
  }
}

class DcBandwidthManager {
  private foremans: Foreman[] = [];

  private maxConnections: number = MAX_CONCURRENT_CONNECTIONS;
  private maxActiveSize: number = MAX_ACTIVE_REQUEST_SIZE;

  private queuedRequests: QueuedRequest[] = [];

  private priorityQueuedRequests: QueuedRequest[] = [];

  activeRequestSize = 0;

  constructor() {
    const maxForemans = Math.max(MAX_CONCURRENT_CONNECTIONS, MAX_CONCURRENT_CONNECTIONS_PREMIUM);

    this.foremans = Array(maxForemans)
      .fill(undefined)
      .map(() => new Foreman(FOREMAN_MAX_HEAP_SIZE));
  }

  updateIsPremium(isPremium: boolean) {
    this.maxConnections = isPremium ? MAX_CONCURRENT_CONNECTIONS_PREMIUM : MAX_CONCURRENT_CONNECTIONS;
    this.maxActiveSize = isPremium ? MAX_ACTIVE_REQUEST_SIZE_PREMIUM : MAX_ACTIVE_REQUEST_SIZE;
  }

  async requestWorker(isPriority: boolean, requestSize: number): Promise<number> {
    // Check if adding this request would exceed the dcId size limit
    if (this.activeRequestSize + requestSize > this.maxActiveSize) {
      const deferred = new Deferred();
      const queuedRequest = { deferred, requestSize };
      if (isPriority) {
        this.priorityQueuedRequests.push(queuedRequest);
      } else {
        this.queuedRequests.push(queuedRequest);
      }
      await deferred.promise;
      // After being dequeued, select and request a foreman
      const foremanIndex = this.getFreeForemanIndex(requestSize);
      const foreman = this.foremans[foremanIndex];
      await foreman.requestWorker(requestSize, isPriority);
      return foremanIndex;
    }

    const foremanIndex = this.getFreeForemanIndex(requestSize);
    const foreman = this.foremans[foremanIndex];
    await foreman.requestWorker(requestSize, isPriority);
    this.activeRequestSize += requestSize;
    return foremanIndex;
  }

  releaseWorker(foremanIndex: number, requestSize: number) {
    this.activeRequestSize -= requestSize;
    this.foremans[foremanIndex].releaseWorker(requestSize);

    // Try to process queued requests
    this.processQueue();
  }

  private processQueue() {
    while (true) {
      const queuedRequest = this.priorityQueuedRequests[0] || this.queuedRequests[0];
      if (!queuedRequest) {
        return;
      }

      if (this.activeRequestSize + queuedRequest.requestSize > this.maxActiveSize) {
        return;
      }

      const request = (this.priorityQueuedRequests.shift() || this.queuedRequests.shift())!;
      this.activeRequestSize += request.requestSize;
      request.deferred.resolve();
    }
  }

  private getFreeForemanIndex(requestSize: number): number {
    let minTotalHeapSize = Infinity;
    let minHeapForemanIndex = 0;

    for (let i = 0; i < this.maxConnections; i++) {
      const foreman = this.foremans[i];
      if (foreman.canAccept(requestSize)) {
        return i; // Prefer filling up free foremans to avoid unnecessary connections
      }

      const totalHeapSize = foreman.activeRequestHeapSize + foreman.queuedRequestHeapSize;
      if (totalHeapSize < minTotalHeapSize) {
        minTotalHeapSize = totalHeapSize;
        minHeapForemanIndex = i;
      }
    }

    // If every foreman is busy, use the one with the smallest total heap size
    return minHeapForemanIndex;
  }

  getForeman(index: number): Foreman {
    return this.foremans[index];
  }

  get queueLength() {
    return this.queuedRequests.length + this.priorityQueuedRequests.length;
  }
}
