/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/lines-between-class-members */

type LocalStorageOptions = {
  withDispatchEvent?: boolean;
};

export class LocalStorage<T> {
  private options: LocalStorageOptions;

  constructor(options: LocalStorageOptions = { withDispatchEvent: true }) {
    this.options = options;
  }

  public fallback(key: string, fallbackValue: T | undefined): T | undefined {
    if (fallbackValue !== undefined) this.set(key, fallbackValue);
    return fallbackValue;
  }

  public getOrFallback(key: string, fallbackValue?: T): T | undefined {
    const value = localStorage.getItem(key);
    // eslint-disable-next-line no-null/no-null
    if (value !== null) {
      try {
        const parsed = JSON.parse(value);
        if (!(parsed satisfies T)) { throw new Error('Type mismatch'); }
        return parsed;
      } catch {
        return this.fallback(key, fallbackValue);
      }
    }

    return this.fallback(key, fallbackValue);
  }

  public getEventName(key: string) {
    return `update_storage_${key}`;
  }

  public set(key: string, value: T | undefined) {
    localStorage.setItem(key, JSON.stringify(value));
    if (this.options.withDispatchEvent) {
      if (window) window.dispatchEvent(new Event(this.getEventName(key)));
    }
  }

  public isEqual(key: string, value: T) {
    const currentValueString = localStorage.getItem(key);
    return currentValueString === JSON.stringify(value);
  }
}
