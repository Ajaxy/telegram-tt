import { useEffect, useState } from '../lib/teact/teact';

import type { Signal } from '../util/signals';

import { detectLanguage } from '../util/languageDetection';

export default function useTextLanguage(text?: string, isDisabled?: boolean, getIsReady?: Signal<boolean>) {
  const [language, setLanguage] = useState<string | undefined>();

  useEffect(() => {
    if (isDisabled || (getIsReady && !getIsReady())) return;

    if (text) {
      detectLanguage(text).then(setLanguage);
    } else {
      setLanguage(undefined);
    }
  }, [isDisabled, text, getIsReady]);

  return language;
}
