import { ApiLangPack } from '../api/types';

import { DEBUG, LANG_CACHE_NAME, LANG_PACKS } from '../config';
import * as cacheApi from './cacheApi';
import { callApi } from '../api/gramjs';
import { createCallbackManager } from './callbacks';
import { mapValues } from './iteratees';

import enExtraJson from '../assets/lang/en-extra.json';
import esExtraJson from '../assets/lang/es-extra.json';
import itExtraJson from '../assets/lang/it-extra.json';
import plExtraJson from '../assets/lang/pl-extra.json';
import ruExtraJson from '../assets/lang/ru-extra.json';
import { formatInteger } from './textFormat';

const EXTRA_PACK_PATHS: Record<string, string> = {
  en: enExtraJson as unknown as string,
  es: esExtraJson as unknown as string,
  it: itExtraJson as unknown as string,
  pl: plExtraJson as unknown as string,
  ru: ruExtraJson as unknown as string,
};

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

export async function setLanguage(langCode: string, callback?: NoneToVoidFunction) {
  if (langPack && langCode === currentLangCode) {
    document.documentElement.lang = langCode;
    if (callback) {
      callback();
    }

    return;
  }

  const newLangPack = await fetchFromCacheOrRemote(langCode);
  if (!newLangPack) {
    return;
  }

  if (EXTRA_PACK_PATHS[langCode]) {
    try {
      const response = await fetch(EXTRA_PACK_PATHS[langCode]);
      const pairs = await response.json();
      const extraLangPack = mapValues(pairs, (value, key) => ({ key, value }));

      Object.assign(newLangPack, extraLangPack);
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
    }
  }

  cache.clear();

  currentLangCode = langCode;
  langPack = newLangPack;
  document.documentElement.lang = langCode;

  if (callback) {
    callback();
  }

  runCallbacks(langPack);
}

export function getTranslation(key: string, value?: any, format?: 'i') {
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
