import { useEffect, useState } from '../lib/teact/teact';
import { getActions } from '../global';

import type { ThemeKey } from '../types';

import { CUSTOM_BG_CACHE_NAME, DARK_THEME_PATTERN_COLOR, DEFAULT_PATTERN_COLOR } from '../config';
import * as cacheApi from '../util/cacheApi';
import { preloadImage } from '../util/files';

const useCustomBackground = (theme: ThemeKey, settingValue?: string) => {
  const { setThemeSettings } = getActions();
  const [value, setValue] = useState(settingValue);

  useEffect(() => {
    if (!settingValue) {
      return;
    }

    if (settingValue.startsWith('#')) {
      setValue(settingValue);
    } else {
      cacheApi.fetch(CUSTOM_BG_CACHE_NAME, theme, cacheApi.Type.Blob)
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          preloadImage(url)
            .then(() => {
              setValue(`url(${url})`);
            });
        })
        .catch(() => {
          setThemeSettings({
            theme,
            background: undefined,
            backgroundColor: undefined,
            isBlurred: true,
            patternColor: theme === 'dark' ? DARK_THEME_PATTERN_COLOR : DEFAULT_PATTERN_COLOR,
          });
        });
    }
  }, [settingValue, theme]);

  return settingValue ? value : undefined;
};

export default useCustomBackground;
