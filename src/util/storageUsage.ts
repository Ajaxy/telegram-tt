import { MEDIA_CACHE_NAME_AVATARS, MEDIA_PROGRESSIVE_CACHE_NAME } from '../config';
import { type CacheEntryInfo, listClearableCacheEntries, removeClearableCacheEntries } from './cacheApi';

export type StorageCategory = 'photos' | 'videos' | 'audio' | 'stickers' | 'files' | 'avatars' | 'other';

export type StorageCategoryUsage = {
  category: StorageCategory;
  size: number;
  count: number;
};

export type StorageUsage = {
  totalSize: number;
  totalCount: number;
  categories: StorageCategoryUsage[];
  deviceUsage?: number;
  deviceQuota?: number;
};

export const STORAGE_CATEGORIES: StorageCategory[] = [
  'photos', 'videos', 'audio', 'stickers', 'files', 'avatars', 'other',
];

const STICKER_TYPES = new Set(['application/x-tgsticker', 'image/webp']);

export async function calculateStorageUsage(
  onProgress?: (scannedCount: number) => void,
): Promise<StorageUsage> {
  const bySize = new Map<StorageCategory, StorageCategoryUsage>();
  let totalSize = 0;
  let totalCount = 0;

  await listClearableCacheEntries((entry) => {
    const category = getEntryCategory(entry);
    const usage = bySize.get(category) || { category, size: 0, count: 0 };
    usage.size += entry.size;
    usage.count++;
    bySize.set(category, usage);

    totalSize += entry.size;
    totalCount++;
    onProgress?.(totalCount);
  });

  const estimate = await navigator.storage?.estimate?.().catch(() => undefined);

  return {
    totalSize,
    totalCount,
    categories: STORAGE_CATEGORIES
      .map((category) => bySize.get(category))
      .filter(Boolean)
      .sort((a, b) => b.size - a.size),
    deviceUsage: estimate?.usage,
    deviceQuota: estimate?.quota,
  };
}

export function clearStorageCategory(category: StorageCategory) {
  return removeClearableCacheEntries((entry) => getEntryCategory(entry) === category);
}

function getEntryCategory(entry: CacheEntryInfo): StorageCategory {
  const isAvatar = entry.cacheName === MEDIA_CACHE_NAME_AVATARS
    || entry.key.startsWith('avatar') || entry.key.startsWith('profile');
  if (isAvatar) return 'avatars';

  const type = entry.contentType;
  if (entry.cacheName === MEDIA_PROGRESSIVE_CACHE_NAME || type.startsWith('video/')) {
    return entry.key.startsWith('sticker') ? 'stickers' : 'videos';
  }
  if (STICKER_TYPES.has(type) || entry.key.startsWith('sticker')) return 'stickers';
  if (type.startsWith('image/')) return 'photos';
  if (type.startsWith('audio/')) return 'audio';
  if (type) return 'files';

  return 'other';
}
