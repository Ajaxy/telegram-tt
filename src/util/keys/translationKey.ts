import type { TranslationTone } from '../../types';
import { TRANSLATION_TONES } from '../../types';

export function getTranslationCacheKey(languageCode: string, tone: TranslationTone = 'neutral'): string {
  return `${languageCode}_${tone}`;
}

export function parseTranslationCacheKey(cacheKey: string): { languageCode: string; tone: TranslationTone } {
  const separatorIndex = cacheKey.lastIndexOf('_');

  if (separatorIndex === -1) {
    return { languageCode: cacheKey, tone: 'neutral' };
  }

  const languageCode = cacheKey.slice(0, separatorIndex);
  const tone = cacheKey.slice(separatorIndex + 1);
  const isValidTone = (TRANSLATION_TONES as readonly string[]).includes(tone);

  if (!isValidTone) {
    return { languageCode: cacheKey, tone: 'neutral' };
  }

  return { languageCode, tone: tone as TranslationTone };
}
