import { useEffect, useState } from '../lib/teact/teact';
import { getActions } from '../global';

import type { ApiWallpaper } from '../api/types';
import type { ThemeKey } from '../types';
import type { WallpaperStorageSource } from '../util/wallpaper/storage';

import { buildDefaultWallpaperSettings } from '../util/wallpaper';
import { acquireWallpaperUrl, cacheThemeWallpaper, getResolvedWallpaperUrl } from '../util/wallpaper/storage';

type ResolvedBackground = {
  slug: string;
  source?: WallpaperStorageSource;
  value: string;
  canKeepAsFallback: boolean;
};

export default function useCustomBackground(
  theme: ThemeKey,
  settingValue?: string,
  shouldKeepPrevious?: boolean,
  source?: WallpaperStorageSource,
  wallpaper?: ApiWallpaper,
) {
  const { setThemeSettings, syncGlobalWallpaperCache } = getActions();
  const [resolved, setResolved] = useState<ResolvedBackground>();

  useEffect(() => {
    // Colors are usable synchronously (handled below); only slugs need their cached blob loaded.
    if (!settingValue || settingValue.startsWith('#')) {
      setResolved(undefined);
      return undefined;
    }

    let isCancelled = false;

    let urlHandle: ReturnType<typeof acquireWallpaperUrl> | undefined;
    async function resolveBackground() {
      if (wallpaper?.document) {
        if (!await cacheThemeWallpaper(wallpaper)) throw new Error('Wallpaper unavailable');
        syncGlobalWallpaperCache({ background: wallpaper.slug });
      }
      if (isCancelled) return undefined;
      urlHandle = acquireWallpaperUrl(settingValue!, source);
      return urlHandle.promise;
    }
    resolveBackground()
      .then((url) => {
        if (isCancelled || !url) return;
        setResolved((prev) => (prev?.slug === settingValue && prev.source === source && prev.value === url
          ? prev
          : {
            slug: settingValue,
            source,
            value: url,
            canKeepAsFallback: Boolean(shouldKeepPrevious),
          }));
      })
      .catch(() => {
        if (isCancelled) return;
        if (source === 'lockScreen' || wallpaper) {
          setResolved(undefined);
          return;
        }
        // The cached blob is gone (e.g. evicted) — fully reset to the default wallpaper
        setThemeSettings({ theme, ...buildDefaultWallpaperSettings(theme) });
      });

    return () => {
      isCancelled = true;
      urlHandle?.release();
      // Pattern masks remain visible while the next mask resolves
      if (!shouldKeepPrevious) {
        setResolved((prev) => (prev?.slug === settingValue ? undefined : prev));
      }
    };
  }, [settingValue, shouldKeepPrevious, source, theme, wallpaper]);

  if (!settingValue) return undefined;
  if (settingValue.startsWith('#')) return settingValue;
  const prefetchedUrl = getResolvedWallpaperUrl(settingValue, source);
  if (prefetchedUrl) return prefetchedUrl;
  if (resolved?.slug === settingValue && resolved.source === source) return resolved.value;
  return shouldKeepPrevious && resolved && resolved.source === source && resolved.canKeepAsFallback
    ? resolved.value
    : undefined;
}
