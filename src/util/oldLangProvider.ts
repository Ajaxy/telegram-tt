import { getGlobal } from '../global';

import type { ApiOldLangPack, ApiOldLangString } from '../api/types';
import type { LangCode, TimeFormat } from '../types';

import {
  LANG_CACHE_NAME, LANG_PACKS,
} from '../config';
import { selectSharedSettings } from '../global/selectors/sharedState';
import { callApi } from '../api/gramjs';
import * as cacheApi from './cacheApi';
import { createCallbackManager } from './callbacks';
import { loadAndChangeLanguage } from './localization';
import { formatInteger } from './textFormat';

export interface LangFn {
  (key: string, value?: any, format?: 'i', pluralValue?: number): string;

  isRtl?: boolean;
  code?: LangCode;
  langName?: string;
  timeFormat?: TimeFormat;
}

const SUBSTITUTION_REGEX = /%\d?\$?[sdf@]/g;
const PLURAL_OPTIONS = ['value', 'zeroValue', 'oneValue', 'twoValue', 'fewValue', 'manyValue', 'otherValue'] as const;
// Some rules edited from https://github.com/eemeli/make-plural/blob/master/packages/plurals/cardinals.js
const PLURAL_RULES = {
  /* eslint-disable @stylistic/max-len */
  en: (n: number) => (n !== 1 ? 6 : 2),
  ar: (n: number) => (n === 0 ? 1 : n === 1 ? 2 : n === 2 ? 3 : n % 100 >= 3 && n % 100 <= 10 ? 4 : n % 100 >= 11 ? 5 : 6),
  be: (n: number) => {
    const s = String(n).split('.');
    const t0 = Number(s[0]) === n;
    const n10 = t0 ? Number(s[0].slice(-1)) : 0;
    const n100 = t0 ? Number(s[0].slice(-2)) : 0;
    return n10 === 1 && n100 !== 11
      ? 2
      : (n10 >= 2 && n10 <= 4) && (n100 < 12 || n100 > 14)
        ? 4
        : (t0 && n10 === 0) || (n10 >= 5 && n10 <= 9) || (n100 >= 11 && n100 <= 14)
          ? 5
          : 6;
  },
  ca: (n: number) => (n !== 1 ? 6 : 2),
  cs: (n: number) => {
    const s = String(n).split('.');
    const i = Number(s[0]);
    const v0 = !s[1];
    return n === 1 && v0 ? 2 : (i >= 2 && i <= 4) && v0 ? 4 : !v0 ? 5 : 6;
  },
  de: (n: number) => (n !== 1 ? 6 : 2),
  es: (n: number) => (n !== 1 ? 6 : 2),
  fa: (n: number) => (n > 1 ? 6 : 2),
  fi: (n: number) => (n !== 1 ? 6 : 2),
  fr: (n: number) => (n > 1 ? 6 : 2),
  id: () => 0,
  it: (n: number) => (n !== 1 ? 6 : 2),
  hr: (n: number) => {
    const s = String(n).split('.');
    const i = s[0];
    const f = s[1] || '';
    const v0 = !s[1];
    const i10 = Number(i.slice(-1));
    const i100 = Number(i.slice(-2));
    const f10 = Number(f.slice(-1));
    const f100 = Number(f.slice(-2));
    return (v0 && i10 === 1 && i100 !== 11) || (f10 === 1 && f100 !== 11) ? 2
      : (v0 && (i10 >= 2 && i10 <= 4) && (i100 < 12 || i100 > 14)) || ((f10 >= 2 && f10 <= 4) && (f100 < 12 || f100 > 14)) ? 4
        : 6;
  },
  hu: (n: number) => (n > 1 ? 6 : 2),
  ko: () => 0,
  ms: () => 0,
  nb: (n: number) => (n > 1 ? 6 : 2),
  nl: (n: number) => (n !== 1 ? 6 : 2),
  pl: (n: number) => (n === 1 ? 2 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 4 : 5),
  'pt-br': (n: number) => (n > 1 ? 6 : 2),
  ru: (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 2 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 4 : 5),
  sk: (n: number) => {
    const s = String(n).split('.');
    const i = Number(s[0]);
    const v0 = !s[1];
    return n === 1 && v0 ? 2 : (i >= 2 && i <= 4) && v0 ? 4 : !v0 ? 5 : 6;
  },
  sr: (n: number) => {
    const s = String(n).split('.');
    const i = s[0];
    const f = s[1] || '';
    const v0 = !s[1];
    const i10 = Number(i.slice(-1));
    const i100 = Number(i.slice(-2));
    const f10 = Number(f.slice(-1));
    const f100 = Number(f.slice(-2));
    return (v0 && i10 === 1 && i100 !== 11) || (f10 === 1 && f100 !== 11) ? 2
      : (v0 && (i10 >= 2 && i10 <= 4) && (i100 < 12 || i100 > 14)) || ((f10 >= 2 && f10 <= 4) && (f100 < 12 || f100 > 14)) ? 4
        : 6;
  },
  tr: (n: number) => (n > 1 ? 6 : 2),
  uk: (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 2 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 4 : 5),
  uz: (n: number) => (n > 1 ? 6 : 2),
  /* eslint-enable @stylistic/max-len */
};

const cache = new Map<string, string>();

let langPack: ApiOldLangPack | undefined;

const {
  addCallback,
  removeCallback,
  runCallbacks,
} = createCallbackManager();

export { addCallback, removeCallback };

let currentLangCode: string | undefined;
let currentTimeFormat: TimeFormat | undefined;

function createLangFn() {
  return (key: string, value?: any, format?: 'i', pluralValue?: number) => {
    if (value !== undefined) {
      const cacheValue = Array.isArray(value) ? JSON.stringify(value) : value;
      const cached = cache.get(`${key}_${cacheValue}_${format}${pluralValue ? `_${pluralValue}` : ''}`);
      if (cached) {
        return cached;
      }
    }

    const langString = langPack?.[key];
    if (!langString) {
      return key;
    }

    return processTranslation(langString, key, value, format, pluralValue);
  };
}

let translationFn: LangFn = createLangFn();

/**
 * @deprecated Do not translate inside non-reactive contexts. Pass parameters to the component instead
 */
export function oldTranslate(...args: Parameters<LangFn>) {
  return translationFn(...args);
}

export function getTranslationFn(): LangFn {
  return translationFn;
}

/**
 * @deprecated Migrate to `changeLanguage` in `util/localization.ts` instead
 */
export async function oldSetLanguage(langCode: LangCode, callback?: NoneToVoidFunction) {
  loadAndChangeLanguage(langCode, true);
  if (langPack && langCode === currentLangCode) {
    if (callback) {
      callback();
    }

    return;
  }

  let newLangPack = await cacheApi.fetch(LANG_CACHE_NAME, langCode, cacheApi.Type.Json);
  if (!newLangPack) {
    newLangPack = await fetchRemote(langCode);
    if (!newLangPack) {
      return;
    }
  }

  cache.clear();

  currentLangCode = langCode;
  langPack = newLangPack;
  document.documentElement.lang = langCode;

  const global = getGlobal();
  const { languages, timeFormat } = selectSharedSettings(global);
  const langInfo = languages?.find((lang) => lang.langCode === langCode);
  translationFn = createLangFn();
  translationFn.isRtl = Boolean(langInfo?.isRtl);
  translationFn.code = langCode.replace('-raw', '') as LangCode;
  translationFn.langName = langInfo?.nativeName;
  translationFn.timeFormat = timeFormat;

  if (callback) {
    callback();
  }

  runCallbacks();
}

export function setTimeFormat(timeFormat: TimeFormat) {
  if (timeFormat && timeFormat === currentTimeFormat) {
    return;
  }

  currentTimeFormat = timeFormat;
  translationFn.timeFormat = timeFormat;

  runCallbacks();
}

async function fetchRemote(langCode: string): Promise<ApiOldLangPack | undefined> {
  const remote = await callApi('oldFetchLangPack', { sourceLangPacks: LANG_PACKS, langCode });
  if (remote) {
    await cacheApi.save(LANG_CACHE_NAME, langCode, remote.langPack);
    return remote.langPack;
  }

  return undefined;
}

function getPluralOption(amount: number) {
  const langCode = currentLangCode || 'en';
  const optionIndex = PLURAL_RULES[langCode as keyof typeof PLURAL_RULES]
    ? PLURAL_RULES[langCode as keyof typeof PLURAL_RULES](amount)
    : 0;

  return PLURAL_OPTIONS[optionIndex];
}

function processTemplate(template: string, value: any) {
  value = Array.isArray(value) ? value : [value];
  const translationSlices = template.split(SUBSTITUTION_REGEX);
  const initialValue = translationSlices.shift();

  return translationSlices.reduce((result, str, index) => {
    return `${result}${String(value[index] ?? '')}${str}`;
  }, initialValue || '');
}

function processTranslation(
  langString: ApiOldLangString | undefined, key: string, value?: any, format?: 'i', pluralValue?: number,
) {
  const preferredPluralOption = typeof value === 'number' || pluralValue !== undefined
    ? getPluralOption(pluralValue ?? value)
    : 'value';
  const template = typeof langString === 'string'
    ? langString
    : preferredPluralOption === 'value'
      // Support cached older `langString` interface
      ? (typeof langString === 'object' ? (langString as any).value : langString)
      : typeof langString === 'object'
        ? langString[preferredPluralOption] || langString.otherValue
        : undefined;

  if (!template?.trim()) {
    const parts = key.split('.');

    return parts[parts.length - 1];
  }

  if (value !== undefined) {
    const formattedValue = format === 'i' ? formatInteger(value) : value;
    const result = processTemplate(template, formattedValue);
    const cacheValue = Array.isArray(value) ? JSON.stringify(value) : value;
    cache.set(`${key}_${cacheValue}_${format}${pluralValue ? `_${pluralValue}` : ''}`, result);
    return result;
  }

  return template;
}
