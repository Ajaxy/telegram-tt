import { useState } from '../lib/teact/teact';

import { detectLanguage } from '../util/languageDetection';

import useSyncEffect from './useSyncEffect';

export default function useTextLanguage(text?: string) {
  const [language, setLanguage] = useState<string>();

  useSyncEffect(() => {
    if (text) {
      detectLanguage(text).then(setLanguage);
    }
  }, [text]);

  return language;
}
