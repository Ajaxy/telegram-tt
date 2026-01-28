import type { TelebizStorageKey } from '../config/storageKeys';

import { MAIN_IDB_STORE } from '../../util/browser/idb';
import { logDebugMessage } from '../../util/debugConsole';
import { ACCOUNT_SLOT, loadSlotSession } from '../../util/multiaccount';

const STORAGE_KEY_PREFIX = 'telebiz';

/**
 * Storage utility singleton that checks localStorage availability once
 */
class TelebizStorage {
  private static instance: TelebizStorage;
  private isAvailable: boolean;
  private availabilityChecked: boolean = false;

  private constructor() {
    this.isAvailable = false;
  }

  static getInstance(): TelebizStorage {
    if (!TelebizStorage.instance) {
      TelebizStorage.instance = new TelebizStorage();
    }
    return TelebizStorage.instance;
  }

  /**
   * Check localStorage availability once and cache the result
   */
  private checkAvailability(): boolean {
    if (this.availabilityChecked) {
      return this.isAvailable;
    }

    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      this.isAvailable = true;
    } catch (error) {
      this.isAvailable = false;
    } finally {
      this.availabilityChecked = true;
    }

    return this.isAvailable;
  }

  /**
   * Get current user ID from session, if available
   */
  private getCurrentUserId(): string | undefined {
    try {
      const session = loadSlotSession(ACCOUNT_SLOT);
      return session?.userId;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Build a storage key with optional user suffix
   */
  private buildKey(key: TelebizStorageKey | string, userSpecific = true): string {
    const baseKey = key.startsWith(String(STORAGE_KEY_PREFIX)) ? key : `${STORAGE_KEY_PREFIX}:${key}`;

    if (userSpecific) {
      const userId = this.getCurrentUserId();
      return userId ? `${baseKey}_${userId}` : baseKey;
    }

    return baseKey;
  }

  /**
   * Get a value from localStorage (supports JSON objects, arrays, and primitives)
   */
  get<T>(key: TelebizStorageKey, defaultValue: T, userSpecific = true): T {
    if (!this.checkAvailability()) {
      return defaultValue;
    }

    try {
      const storageKey = this.buildKey(key, userSpecific);
      const item = localStorage.getItem(storageKey);

      if (!item) {
        return defaultValue;
      }

      // Try to parse as JSON, fallback to string if it fails
      try {
        return JSON.parse(item) as T;
      } catch {
        // If parse fails, return as string (handles plain string values)
        return item as unknown as T;
      }
    } catch (error) {
      logDebugMessage('warn', `Failed to get localStorage item "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * Set a value in localStorage (supports JSON objects, arrays, and primitives)
   */
  set<T>(key: TelebizStorageKey, value: T, userSpecific = true): boolean {
    if (!this.checkAvailability()) {
      return false;
    }

    try {
      const storageKey = this.buildKey(key, userSpecific);
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(storageKey, serialized);
      return true;
    } catch (error) {
      logDebugMessage('warn', `Failed to set localStorage item "${key}":`, error);
      return false;
    }
  }

  async idbGet<T>(key: TelebizStorageKey, userSpecific = true): Promise<T | undefined> {
    const storageKey = this.buildKey(key, userSpecific);
    return MAIN_IDB_STORE.get<T>(storageKey);
  }

  async idbSet<T>(key: TelebizStorageKey, value: T, userSpecific = true): Promise<void> {
    const storageKey = this.buildKey(key, userSpecific);
    await MAIN_IDB_STORE.set(storageKey, value);
  }

  /**
   * Remove an item from localStorage
   */
  remove(key: TelebizStorageKey, userSpecific = true): boolean {
    if (!this.checkAvailability()) {
      return false;
    }

    try {
      const storageKey = this.buildKey(key, userSpecific);
      localStorage.removeItem(storageKey);
      return true;
    } catch (error) {
      logDebugMessage('warn', `Failed to remove localStorage item "${key}":`, error);
      return false;
    }
  }

  /**
   * Clear all telebiz-related items from localStorage
   * Optionally clears user-specific items only
   */
  clear(userSpecificOnly = false): void {
    if (!this.checkAvailability()) {
      return;
    }

    try {
      const keysToRemove: string[] = [];
      const userId = this.getCurrentUserId();

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        const isTelebizKey = key.startsWith(STORAGE_KEY_PREFIX);
        const isUserSpecific = userSpecificOnly && userId
          ? key.includes(`_${userId}`)
          : false;

        if (isTelebizKey && (!userSpecificOnly || isUserSpecific)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      logDebugMessage('warn', 'Failed to clear telebiz storage:', error);
    }
  }
}

// Export singleton instance methods as convenience functions
const storage = TelebizStorage.getInstance();

export default storage;
