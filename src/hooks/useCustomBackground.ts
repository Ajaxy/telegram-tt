import { useEffect, useState } from '../lib/teact/teact';
import { getActions } from '../global';

import type { ThemeKey } from '../types';

import { getDefaultPatternColor, RESET_WALLPAPER_SETTINGS } from '../util/wallpaper';
import { acquireWallpaperUrl, getResolvedWallpaperUrl } from '../util/wallpaperStorage';

type ResolvedBackground = {
  slug: string;
  value: string;
  canKeepAsFallback: boolean;
};

const useCustomBackground = (theme: ThemeKey, settingValue?: string, shouldKeepPrevious?: boolean) => {
  const { setThemeSettings } = getActions();
  // An already-prefetched URL is available on the first render
  const [resolved, setResolved] = useState<ResolvedBackground | undefined>(() => {
    if (!settingValue || settingValue.startsWith('#')) return undefined;

    const prefetchedUrl = getResolvedWallpaperUrl(settingValue);
    return prefetchedUrl ? {
      slug: settingValue,
      value: `url(${prefetchedUrl})`,
      canKeepAsFallback: Boolean(shouldKeepPrevious),
    } : undefined;
  });

  useEffect(() => {
    // Colors are usable synchronously (handled below); only slugs need their cached blob loaded.
    if (!settingValue || settingValue.startsWith('#')) {
      setResolved(undefined);
      return undefined;
    }

    let isCancelled = false;

    const urlHandle = acquireWallpaperUrl(settingValue);
    urlHandle.promise
      .then((url) => {
        if (isCancelled) return;
        const value = `url(${url})`;
        setResolved((prev) => (prev?.slug === settingValue && prev.value === value
          ? prev
          : {
            slug: settingValue,
            value,
            canKeepAsFallback: Boolean(shouldKeepPrevious),
          }));
      })
      .catch(() => {
        if (isCancelled) return;
        // The cached blob is gone (e.g. evicted) — fully reset to the default wallpaper
        setThemeSettings({
          theme,
          ...RESET_WALLPAPER_SETTINGS,
          isBlurred: true,
          patternColor: getDefaultPatternColor(theme),
        });
      });

    return () => {
      isCancelled = true;
      urlHandle.release();
      // Pattern masks remain visible while the next mask resolves
      if (!shouldKeepPrevious) {
        setResolved((prev) => (prev?.slug === settingValue ? undefined : prev));
      }
    };
  }, [settingValue, shouldKeepPrevious, theme]);

  if (!settingValue) return undefined;
  if (settingValue.startsWith('#')) return settingValue;
  if (resolved?.slug === settingValue) return resolved.value;
  return shouldKeepPrevious && resolved?.canKeepAsFallback ? resolved.value : undefined;
};

export default useCustomBackground;
