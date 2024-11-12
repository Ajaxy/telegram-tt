/**
 * A Map that has a limited size. When the limit is reached, the oldest entry is removed.
 * Ignores last access time, only cares about insertion order.
 */
export default class LimitedMap<K, V> {
  private map: Map<K, V>;

  private insertionQueue: Set<K>;

  constructor(private limit: number) {
    this.map = new Map();
    this.insertionQueue = new Set<K>();
  }

  public get(key: K): V | undefined {
    return this.map.get(key);
  }

  public set(key: K, value: V): this {
    if (this.map.size === this.limit) {
      const keyToRemove = Array.from(this.insertionQueue).shift();
      if (keyToRemove) {
        this.map.delete(keyToRemove);
        this.insertionQueue.delete(keyToRemove);
      }
    }

    this.map.set(key, value);
    this.insertionQueue.add(key);

    return this;
  }

  public has(key: K): boolean {
    return this.map.has(key);
  }

  public delete(key: K): boolean {
    const result = this.map.delete(key);
    if (result) {
      this.insertionQueue.delete(key);
    }
    return result;
  }

  public clear(): void {
    this.map.clear();
    this.insertionQueue.clear();
  }

  public forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void {
    this.map.forEach(callbackfn, thisArg);
  }

  public get size(): number {
    return this.map.size;
  }

  public get [Symbol.toStringTag](): string {
    return this.map[Symbol.toStringTag];
  }

  public [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.map[Symbol.iterator]();
  }

  public entries(): IterableIterator<[K, V]> {
    return this.map.entries();
  }

  public keys(): IterableIterator<K> {
    return this.map.keys();
  }

  public values(): IterableIterator<V> {
    return this.map.values();
  }
}
