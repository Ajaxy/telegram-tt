import { useEffect, useRef, useState } from '../lib/teact/teact';

import type { Signal } from '../util/signals';

import { detectLanguage } from '../util/languageDetection';

export default function useTextLanguage(text?: string, isDisabled?: boolean, getIsReady?: Signal<boolean>) {
  const [language, setLanguage] = useState<string>();
  const lastTextRef = useRef<string>();

  useEffect(() => {
    if (isDisabled || (getIsReady && !getIsReady()) || lastTextRef.current === text) return;

    let isCancelled = false;

    if (!text) {
      setLanguage(undefined);
      lastTextRef.current = undefined;
      return;
    }

    detectLanguage(text).then((lang) => {
      if (isCancelled) {
        return;
      }

      setLanguage(lang);
    }).finally(() => {
      if (isCancelled) {
        return;
      }

      lastTextRef.current = text;
    });

    return () => {
      isCancelled = true;
    };
  }, [isDisabled, text, getIsReady]);

  return language;
}
