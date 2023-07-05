export default class SortedQueue<T> {
  private queue: T[];

  constructor(private comparator: (a: T, b: T) => number) {
    this.queue = [];
  }

  add(item: T): void {
    const index = this.binarySearch(item);
    this.queue.splice(index, 0, item);
  }

  pop(): T | undefined {
    return this.queue.shift();
  }

  get size(): number {
    return this.queue.length;
  }

  clear(): void {
    this.queue = [];
  }

  private binarySearch(item: T): number {
    let left = 0;
    let right = this.queue.length;

    while (left < right) {
      const middle = Math.floor((left + right) / 2);
      const comparison = this.comparator(item, this.queue[middle]);

      if (comparison === 0) {
        return middle;
      } else if (comparison > 0) {
        left = middle + 1;
      } else {
        right = middle;
      }
    }

    return left;
  }
}
