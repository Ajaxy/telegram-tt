import { ApiLangPack } from '../api/types';

import { LANG_CACHE_NAME, LANG_PACKS } from '../config';
import * as cacheApi from './cacheApi';
import { callApi } from '../api/gramjs';
import { createCallbackManager } from './callbacks';
import { formatInteger } from './textFormat';
import { getGlobal } from '../lib/teact/teactn';

interface LangFn {
  (key: string, value?: any, format?: 'i'): any;

  isRtl?: boolean;
}

const PLURAL_OPTIONS = ['value', 'zeroValue', 'oneValue', 'twoValue', 'fewValue', 'manyValue', 'otherValue'] as const;
const PLURAL_RULES = {
  /* eslint-disable max-len */
  en: (n: number) => (n !== 1 ? 6 : 2),
  ar: (n: number) => (n === 0 ? 1 : n === 1 ? 2 : n === 2 ? 3 : n % 100 >= 3 && n % 100 <= 10 ? 4 : n % 100 >= 11 ? 5 : 6),
  ca: (n: number) => (n !== 1 ? 6 : 2),
  de: (n: number) => (n !== 1 ? 6 : 2),
  es: (n: number) => (n !== 1 ? 6 : 2),
  fa: (n: number) => (n > 1 ? 6 : 2),
  fr: (n: number) => (n > 1 ? 6 : 2),
  id: () => 0,
  it: (n: number) => (n !== 1 ? 6 : 2),
  ko: () => 0,
  ms: () => 0,
  nl: (n: number) => (n !== 1 ? 6 : 2),
  pl: (n: number) => (n === 1 ? 2 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 4 : 5),
  pt_BR: (n: number) => (n > 1 ? 6 : 2),
  ru: (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 2 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 4 : 5),
  tr: (n: number) => (n > 1 ? 6 : 2),
  uk: (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 2 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 4 : 5),
  uz: (n: number) => (n > 1 ? 6 : 2),
  /* eslint-enable max-len */
};

const cache = new Map<string, string>();

let langPack: ApiLangPack;

const {
  addCallback,
  removeCallback,
  runCallbacks,
} = createCallbackManager();

export { addCallback, removeCallback };

let currentLangCode: string | undefined;

export const getTranslation: LangFn = (key: string, value?: any, format?: 'i') => {
  if (value !== undefined) {
    const cached = cache.get(`${key}_${value}_${format}`);
    if (cached) {
      return cached;
    }
  }

  if (!langPack) {
    return key;
  }

  const langString = langPack[key];
  if (!langString) {
    return key;
  }

  const template = langString[typeof value === 'number' ? getPluralOption(value) : 'value'];
  if (!template || !template.trim()) {
    const parts = key.split('.');

    return parts[parts.length - 1];
  }

  if (value !== undefined) {
    const formattedValue = format === 'i' ? formatInteger(value) : value;
    const result = processTemplate(template, formattedValue);
    cache.set(`${key}_${value}_${format}`, result);
    return result;
  }

  return template;
};

export async function setLanguage(langCode: string, callback?: NoneToVoidFunction) {
  if (langPack && langCode === currentLangCode) {
    if (callback) {
      callback();
    }

    return;
  }

  const newLangPack = await fetchFromCacheOrRemote(langCode);
  if (!newLangPack) {
    return;
  }

  cache.clear();

  currentLangCode = langCode;
  langPack = newLangPack;
  document.documentElement.lang = langCode;

  const { languages } = getGlobal().settings.byKey;
  const langInfo = languages ? languages.find((l) => l.langCode === langCode) : undefined;
  getTranslation.isRtl = Boolean(langInfo && langInfo.rtl);

  if (callback) {
    callback();
  }

  runCallbacks(langPack);
}

async function fetchFromCacheOrRemote(langCode: string): Promise<ApiLangPack | undefined> {
  const cached = await cacheApi.fetch(LANG_CACHE_NAME, langCode, cacheApi.Type.Json);
  if (cached) {
    return cached;
  }

  const remote = await callApi('fetchLangPack', { sourceLangPacks: LANG_PACKS, langCode });
  if (remote) {
    await cacheApi.save(LANG_CACHE_NAME, langCode, remote.langPack);
    return remote.langPack;
  }

  return undefined;
}

function getPluralOption(amount: number) {
  const optionIndex = currentLangCode && PLURAL_RULES[currentLangCode as keyof typeof PLURAL_RULES]
    ? PLURAL_RULES[currentLangCode as keyof typeof PLURAL_RULES](amount)
    : 0;

  return PLURAL_OPTIONS[optionIndex];
}

function processTemplate(template: string, value: any) {
  return template.replace(/%\d?\$?[sdf@]/, String(value));
}
