import { useState } from '../lib/teact/teact';

import { detectLanguage } from '../util/languageDetection';

import useSyncEffect from './useSyncEffect';

export default function useTextLanguage(text?: string, isDisabled?: boolean) {
  const [language, setLanguage] = useState<string | undefined>();

  useSyncEffect(() => {
    if (text && !isDisabled) {
      detectLanguage(text).then(setLanguage);
    } else {
      setLanguage(undefined);
    }
  }, [isDisabled, text]);

  return language;
}
