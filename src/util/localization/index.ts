import type { TeactNode } from '../../lib/teact/teact';

import type {
  ApiLanguage,
  CachedLangData,
  LangPack,
  LangPackStringValue,
} from '../../api/types';
import type { LangKey, LangVariable } from '../../types/language';
import {
  type AdvancedLangFnOptions,
  type AdvancedLangFnOptionsWithPlural,
  areAdvancedLangFnOptions,
  isDeletedLangString,
  isPluralLangString,
  type LangFn,
  type LangFnOptions,
  type LangFnOptionsWithPlural,
  type LangFnParameters,
  type LangFormatters,
} from './types';

import { DEBUG, LANG_PACK } from '../../config';
import { callApi } from '../../api/gramjs';
import renderText, { type TextFilter } from '../../components/common/helpers/renderText';
import { MAIN_IDB_STORE } from '../browser/idb';
import { getBasicListFormat } from '../browser/intlListFormat';
import { createCallbackManager } from '../callbacks';
import readFallbackStrings from '../data/readFallbackStrings';
import { initialEstablishmentPromise, isCurrentTabMaster } from '../establishMultitabRole';
import { omit, unique } from '../iteratees';
import { notifyLangpackUpdate } from '../multitab';
import { replaceInStringsWithTeact } from '../replaceWithTeact';
import { fastRaf } from '../schedulers';
import { IS_INTL_LIST_FORMAT_SUPPORTED, IS_MULTITAB_SUPPORTED } from '../windowEnvironment';

import Deferred from '../Deferred';
import LimitedMap from '../primitives/LimitedMap';

import initialStrings from '../../assets/localization/initialStrings';

const LANGPACK_STORE_PREFIX = 'langpack-';
const FORMATTERS_FALLBACK_LANG = 'en';

const STRING_CACHE_LIMIT = 400;
const TRANSLATION_CACHE = new LimitedMap<string, string>(STRING_CACHE_LIMIT);

let language: ApiLanguage | undefined;
let formatters: LangFormatters | undefined;

let langPack: LangPack | undefined;
let fallbackLangPack: LangPack | undefined;

let translationFn = createTranslationFn();

const {
  addCallback,
  removeCallback,
  runCallbacks,
} = createCallbackManager();

let areCallbacksScheduled = false;
function scheduleCallbacks() {
  if (areCallbacksScheduled) return;
  areCallbacksScheduled = true;
  fastRaf(() => {
    runCallbacks();
    areCallbacksScheduled = false;
  });
}

const localizationReady = new Deferred<void>();

function loadCachedLangData(langCode: string) {
  return MAIN_IDB_STORE.get<CachedLangData>(`${LANGPACK_STORE_PREFIX}${langCode}`);
}

function cacheLangData(data: CachedLangData) {
  notifyLangpackUpdate(data.language.langCode);
  return MAIN_IDB_STORE.set(`${LANGPACK_STORE_PREFIX}${data.language.langCode}`, data);
}

let fallbackLoadPromise: Promise<CachedLangData> | undefined;
async function loadFallbackPack() {
  if (fallbackLangPack || fallbackLoadPromise) return;
  fallbackLoadPromise = readFallbackStrings();
  const fallbackData = await fallbackLoadPromise;
  fallbackLangPack = fallbackData.langPack;

  TRANSLATION_CACHE.clear();

  if (!language) {
    updateLanguage(fallbackData.language);
  } else {
    translationFn = createTranslationFn();
    scheduleCallbacks();
  }
}

async function fetchDifference() {
  if (!langPack || !language) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('[Localization] Trying to fetch difference without loaded data');
    }
    return;
  }

  if (IS_MULTITAB_SUPPORTED) {
    await initialEstablishmentPromise;
    if (!isCurrentTabMaster()) return;
  }

  const result = await callApi('fetchLangDifference', {
    langPack: LANG_PACK,
    langCode: langPack.langCode,
    fromVersion: langPack.version,
  });
  if (!result) return;

  applyLangPackDifference(result.version, result.strings, result.keysToRemove);
}

export function applyLangPackDifference(
  version: number, strings: Record<string, LangPackStringValue>, keysToRemove: string[],
) {
  if (!langPack || !language || version === langPack.version) return;

  const newLangPack = {
    ...langPack,
    version,
    strings: {
      ...omit(langPack.strings, keysToRemove),
      ...strings,
    },
  };
  updateLangPack(newLangPack);

  cacheLangData({
    langPack: newLangPack,
    language,
  });
  scheduleCallbacks();
}

function updateLanguage(newLang: ApiLanguage) {
  language = newLang;

  createFormatters();

  translationFn = createTranslationFn();

  scheduleCallbacks();
}

function createFormatters() {
  if (!language) return;
  const langCode = language.pluralCode;
  const listFormatFallback = getBasicListFormat();

  function createListFormat(lang: string, type: 'conjunction' | 'disjunction') {
    return IS_INTL_LIST_FORMAT_SUPPORTED ? new Intl.ListFormat(lang, { type }) : listFormatFallback;
  }

  try {
    formatters = {
      pluralRules: new Intl.PluralRules(langCode),
      region: new Intl.DisplayNames(langCode, { type: 'region' }),
      conjunction: createListFormat(langCode, 'conjunction'),
      disjunction: createListFormat(langCode, 'disjunction'),
      number: new Intl.NumberFormat(langCode),
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Failed to create formatters:', e);
    formatters = {
      pluralRules: new Intl.PluralRules(FORMATTERS_FALLBACK_LANG),
      region: new Intl.DisplayNames(FORMATTERS_FALLBACK_LANG, { type: 'region' }),
      conjunction: createListFormat(FORMATTERS_FALLBACK_LANG, 'conjunction'),
      disjunction: createListFormat(FORMATTERS_FALLBACK_LANG, 'disjunction'),
      number: new Intl.NumberFormat(FORMATTERS_FALLBACK_LANG),
    };
  }
}

function updateLangPack(newLangPack: LangPack) {
  langPack = newLangPack;

  TRANSLATION_CACHE.clear();

  scheduleCallbacks();
}

export async function initLocalization(langCode: string, canLoadFromServer?: boolean) {
  if (language) return;

  const cachedData = await loadCachedLangData(langCode);
  if (cachedData) {
    langPack = cachedData.langPack;
    language = cachedData.language;
    createFormatters();

    fetchDifference();
  } else if (canLoadFromServer) {
    await loadAndChangeLanguage(langCode);
  } else {
    loadFallbackPack();
  }

  translationFn = createTranslationFn();
  scheduleCallbacks();
  localizationReady.resolve();
}

export async function refreshFromCache(langCode: string) {
  if (isCurrentTabMaster()) return;

  const cachedData = await loadCachedLangData(langCode);
  if (cachedData) {
    updateLangPack(cachedData.langPack);
    updateLanguage(cachedData.language);
  }
}

export async function loadAndChangeLanguage(langCode: string, shouldCheckCache?: boolean) {
  if (shouldCheckCache) { // Can be removed when old lang provider is phased out. Cache is checked in `initLocalization`.
    const cachedData = await loadCachedLangData(langCode);
    if (cachedData) {
      return changeLanguage(cachedData.language);
    }
  }

  if (IS_MULTITAB_SUPPORTED) {
    await initialEstablishmentPromise;
    if (!isCurrentTabMaster()) return undefined;
  }

  const remoteLanguage = await callApi('fetchLanguage', {
    langPack: LANG_PACK,
    langCode,
  });

  if (!remoteLanguage) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('Failed to fetch language', langCode);
    }
    return undefined;
  }

  return changeLanguage(remoteLanguage);
}

export function requestLangPackDifference(langCode: string) {
  if (language?.langCode !== langCode) return;
  fetchDifference();
}

export async function changeLanguage(newLanguage: ApiLanguage) {
  if (langPack && language?.langCode === newLanguage.langCode) return;

  const cachedData = await loadCachedLangData(newLanguage.langCode);
  if (cachedData) {
    updateLangPack(cachedData.langPack);
    updateLanguage(cachedData.language);

    fetchDifference();
  } else {
    if (IS_MULTITAB_SUPPORTED) {
      await initialEstablishmentPromise;
      if (!isCurrentTabMaster()) return;
    }
    const remoteLangPack = await callApi('fetchLangPack', {
      langPack: LANG_PACK,
      langCode: newLanguage.langCode,
    });
    if (!remoteLangPack) {
      // eslint-disable-next-line no-console
      console.warn('Failed to fetch lang pack');
      return;
    }

    updateLangPack({
      langCode: newLanguage.langCode,
      version: remoteLangPack.version,
      strings: remoteLangPack.strings,
    });
    updateLanguage(newLanguage);

    cacheLangData({
      langPack: langPack!,
      language: newLanguage,
    });
  }

  document.documentElement.lang = newLanguage.baseLangCode || newLanguage.langCode;

  scheduleCallbacks();
}

function createTranslationFn(): LangFn {
  const fn: LangFn = ((
    key: LangKey,
    variables: Record<string, unknown> | undefined,
    options: LangFnOptions | AdvancedLangFnOptions | undefined,
  ) => {
    if (options && areAdvancedLangFnOptions(options)) {
      return processTranslationAdvanced(key, variables as Record<string, TeactNode>, options);
    }
    return processTranslation(key, variables as Record<string, string | number>, options);
  }) as LangFn;
  fn.code = language?.langCode || FORMATTERS_FALLBACK_LANG;
  fn.isRtl = language?.isRtl;
  fn.pluralCode = language?.pluralCode || FORMATTERS_FALLBACK_LANG;
  fn.with = (({ key, variables, options }: LangFnParameters) => {
    if (options && areAdvancedLangFnOptions(options)) {
      return processTranslationAdvanced(key, variables as Record<string, TeactNode | undefined>, options);
    }
    return processTranslation(key, variables as Record<string, LangVariable>, options);
  });
  fn.region = (code: string) => formatters?.region.of(code);
  fn.conjunction = (list: string[]) => formatters?.conjunction.format(list) || list.join(', ');
  fn.disjunction = (list: string[]) => formatters?.disjunction.format(list) || list.join(', ');
  fn.number = (value: number) => formatters?.number.format(value) || String(value);
  return fn;
}

export function getTranslationFn(): LangFn {
  return translationFn;
}

function getString(langKey: LangKey, count: number) {
  let langPackStringValue = langPack?.strings[langKey];

  if (!langPackStringValue && !fallbackLangPack) {
    loadFallbackPack();
  }

  langPackStringValue ||= fallbackLangPack?.strings[langKey];
  langPackStringValue ||= initialStrings[langKey];

  if (!langPackStringValue || isDeletedLangString(langPackStringValue)) return undefined;

  const pluralSuffix = formatters?.pluralRules.select(count) || 'other';

  const string = isPluralLangString(langPackStringValue)
    ? (langPackStringValue[pluralSuffix] || langPackStringValue.other)
    : langPackStringValue;

  return string;
}

function processTranslation(
  langKey: LangKey,
  variables?: Record<string, LangVariable>,
  options?: LangFnOptions | LangFnOptionsWithPlural,
): string {
  const cacheKey = `${langKey}-${JSON.stringify(variables)}-${JSON.stringify(options)}`;
  if (TRANSLATION_CACHE.has(cacheKey)) {
    return TRANSLATION_CACHE.get(cacheKey)!;
  }

  const pluralValue = options && 'pluralValue' in options ? Number(options.pluralValue) : 0;
  const string = getString(langKey, pluralValue);

  if (!string) return langKey;

  const variableEntries = variables ? Object.entries(variables) : [];
  const finalString = variableEntries.reduce((result, [key, value]) => {
    if (value === undefined) return result;

    const valueAsString = Number.isFinite(value) ? formatters!.number.format(value as number) : String(value);
    return result.replace(`{${key}}`, valueAsString);
  }, string);

  TRANSLATION_CACHE.set(cacheKey, finalString);

  return finalString;
}

function processTranslationAdvanced(
  langKey: LangKey,
  variables?: Record<string, TeactNode | undefined>,
  options?: AdvancedLangFnOptions | AdvancedLangFnOptionsWithPlural,
): TeactNode {
  const pluralValue = options && 'pluralValue' in options ? Number(options.pluralValue) : 0;
  const string = getString(langKey, pluralValue);
  if (!string) return langKey;

  const variableEntries = variables ? Object.entries(variables) : [];

  let tempResult: TeactNode = [string];
  if (options?.specialReplacement) {
    const specialReplacements = Object.entries(options.specialReplacement);
    tempResult = specialReplacements.reduce((acc, [key, value]) => {
      return replaceInStringsWithTeact(acc, key, value);
    }, tempResult);
  }

  const withRenderText = options?.withMarkdown || options?.renderTextFilters;

  if (withRenderText) {
    const filters = options?.withMarkdown
      ? unique((options.renderTextFilters || []).concat(['simple_markdown', 'emoji']) as TextFilter[])
      : options.renderTextFilters;

    return tempResult.flatMap((curr: TeactNode) => {
      if (typeof curr !== 'string') {
        return curr;
      }

      return renderText(curr, filters, {
        markdownPostProcessor: (part: string) => {
          return variableEntries.reduce((result, [key, value]): TeactNode[] => {
            if (value === undefined) return result;

            const preparedValue = Number.isFinite(value) ? formatters!.number.format(value as number) : value;
            return replaceInStringsWithTeact(result, `{${key}}`, preparedValue);
          }, [part] as TeactNode[]);
        },
      });
    });
  }

  return variableEntries.reduce((result, [key, value]): TeactNode[] => {
    if (value === undefined) return result;

    const preparedValue = Number.isFinite(value) ? formatters!.number.format(value as number) : value;
    return replaceInStringsWithTeact(result, `{${key}}`, preparedValue);
  }, tempResult);
}

export const localizationReadyPromise = localizationReady.promise;

export {
  addCallback as addLocalizationCallback,
  removeCallback as removeLocalizationCallback,
};

export type {
  LangFn,
  LangFnParameters,
};
