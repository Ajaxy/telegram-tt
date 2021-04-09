import { CUSTOM_BG_CACHE_NAME } from '../config';
import * as cacheApi from '../util/cacheApi';
import { useEffect, useState } from '../lib/teact/teact';

export default (settingValue?: string) => {
  const [value, setValue] = useState(settingValue);

  useEffect(() => {
    if (!settingValue) {
      return;
    }

    if (settingValue.startsWith('#')) {
      setValue(settingValue);
    } else {
      cacheApi.fetch(CUSTOM_BG_CACHE_NAME, CUSTOM_BG_CACHE_NAME, cacheApi.Type.Blob)
        .then((blob) => {
          setValue(`url(${URL.createObjectURL(blob)}`);
        });
    }
  }, [settingValue]);

  return value;
};
