import { useMemo } from '../../lib/teact/teact';

import type { TelebizLangKey } from '../lang/telebizLangPack';

import { addLocalizationCallback, getTranslationFn } from '../../util/localization';
import { telebizEnglishTranslations } from '../lang/translations/en';
import { telebizSpanishTranslations } from '../lang/translations/es';

import useEffectOnce from '../../hooks/useEffectOnce';
import useForceUpdate from '../../hooks/useForceUpdate';

// Language-specific translation packs
const LANGUAGE_PACKS: Record<string, Record<TelebizLangKey, string>> = {
  en: telebizEnglishTranslations,
  es: telebizSpanishTranslations,
  // Add more languages here as needed
};

export function useTelebizLang() {
  const forceUpdate = useForceUpdate();

  // Subscribe to language changes (same pattern as useLang)
  useEffectOnce(() => {
    return addLocalizationCallback(forceUpdate);
  });

  const lang = useMemo(() => {
    const mainLang = getTranslationFn();

    // Get current language code from Telegram's system
    const currentLangCode = mainLang.code || 'en';
    const shortLangCode = currentLangCode.split('-')[0]; // e.g., 'en-US' -> 'en'

    // Get the appropriate language pack
    const langPack = LANGUAGE_PACKS[shortLangCode] || telebizEnglishTranslations;

    return (key: TelebizLangKey, params?: Record<string, string>): string => {
      if (!langPack[key]) return key;
      if (params) {
        return langPack[key].replace(/{(\w+)}/g, (match, p1) => params[p1] || match);
      }
      return langPack[key];
    };
  }, []); // Empty dependency array since we're using forceUpdate

  return lang;
}
