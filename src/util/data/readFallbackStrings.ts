import type {
  ApiLanguage, CachedLangData, LangPack, LangPackStringValuePlural,
} from '../../api/types';

import readStrings from './readStrings';

const FALLBACK_LANG_CODE = 'en';
const FALLBACK_VERSION = 0;
const FALLBACK_TRANSLATE_URL = 'https://translations.telegram.org/en/weba';

export default async function readFallbackStrings(forLocalScript?: boolean): Promise<CachedLangData> {
  let fileData;
  if (forLocalScript) {
    fileData = (await import('fs')).readFileSync('./src/assets/localization/fallback.strings', 'utf8');
  } else {
    const file = await import('../../assets/localization/fallback.strings');
    fileData = file.default;
  }
  const rawStrings = readStrings(fileData);

  const strings: LangPack['strings'] = {};

  Object.entries(rawStrings).forEach(([key, value]) => {
    const [clearKey, pluralSuffix] = key.split('_');

    if (!pluralSuffix) {
      strings[clearKey] = value;
      return;
    }

    const knownValue = (strings[clearKey] || {}) as LangPackStringValuePlural;
    knownValue[pluralSuffix as keyof LangPackStringValuePlural] = value;
    strings[clearKey] = knownValue;
  });

  const langPack: LangPack = {
    langCode: FALLBACK_LANG_CODE,
    version: FALLBACK_VERSION,
    strings,
  };

  const stringsCount = Object.keys(strings).length;

  const language: ApiLanguage = {
    langCode: FALLBACK_LANG_CODE,
    name: 'English',
    nativeName: 'English',
    pluralCode: FALLBACK_LANG_CODE,
    stringsCount,
    translatedCount: stringsCount,
    translationsUrl: FALLBACK_TRANSLATE_URL,
  };

  return {
    langPack,
    language,
  };
}
