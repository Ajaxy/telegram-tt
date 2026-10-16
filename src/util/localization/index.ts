import type { TeactNode } from '../../lib/teact/teact';

import type {
  ApiLanguage,
  ApiUpdateLangPack,
  CachedLangData,
  LangPack,
} from '../../api/types';
import type { TimeFormat } from '../../types';
import type { LangKey, LangVariable } from '../../types/language';
import {
  type AdvancedLangFnOptions,
  type AdvancedLangFnOptionsWithPlural,
  type AdvancedLangFnParameters,
  areAdvancedLangFnOptions,
  isDeletedLangString,
  isPluralLangString,
  type LangFn,
  type LangFnOptions,
  type LangFnOptionsWithPlural,
  type LangFnParameters,
  type LangFormatters,
  type RegularLangFnParameters,
} from './types';

import { FORCE_FALLBACK_LANG, LANG_PACK } from '../../config';
import { callApi } from '../../api/gramjs';
import renderText, { type TextFilter } from '../../components/common/helpers/renderText';
import { IS_INTL_LIST_FORMAT_SUPPORTED } from '../browser/globalEnvironment';
import { MAIN_IDB_STORE } from '../browser/idb';
import { getBasicListFormat } from '../browser/intlListFormat';
import { notifyLangpackUpdate } from '../browser/multitab';
import { createCallbackManager } from '../callbacks';
import readFallbackStrings from '../data/readFallbackStrings';
import { initialEstablishmentPromise, isCurrentTabMaster } from '../establishMultitabRole';
import { omit, unique } from '../iteratees';
import { replaceInStringsWithTeact } from '../replaceWithTeact';
import { fastRaf } from '../schedulers';
import { resetDateFormatCache } from './dateFormat';

import Deferred from '../Deferred';
import LimitedMap from '../primitives/LimitedMap';

import initialStrings from '../../assets/localization/initialStrings';

const FALLBACK_LANG_CODE = 'en';
const LANGPACK_STORE_PREFIX = 'langpack-';
const FORMATTERS_FALLBACK_LANG = FALLBACK_LANG_CODE;
const FALLBACK_PLURAL_RULES = new Intl.PluralRules(FALLBACK_LANG_CODE);

const STRING_CACHE_LIMIT = 400;
const TRANSLATION_CACHE = new LimitedMap<string, string>(STRING_CACHE_LIMIT);

let language: ApiLanguage | undefined;
let formatters: LangFormatters;

let langPack: LangPack | undefined;
let fallbackLangPack: LangPack | undefined;
let currentTimeFormat: TimeFormat = '24h';
let languageRequestId = 0;
let initializationPromise: Promise<void> | undefined;
let selectionPromise: Promise<boolean> | undefined;

createFormatters();
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

async function loadCachedLangData(langCode: string) {
  try {
    return await MAIN_IDB_STORE.get<CachedLangData>(`${LANGPACK_STORE_PREFIX}${langCode}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Failed to read language cache:', err);
    return undefined;
  }
}

async function cacheLangData(data: CachedLangData) {
  let cachedData = data;
  try {
    await MAIN_IDB_STORE.update<CachedLangData>(`${LANGPACK_STORE_PREFIX}${data.language.langCode}`, (previousData) => {
      if (previousData && previousData.langPack.version > data.langPack.version) cachedData = previousData;
      return cachedData;
    });
    notifyLangpackUpdate(data.language.langCode);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Failed to cache language:', err);
  }
  return cachedData;
}

let fallbackLoadPromise: Promise<CachedLangData | undefined> | undefined;
function loadFallbackPack() {
  fallbackLoadPromise ||= readFallbackStrings().then((fallbackData) => {
    fallbackLangPack = fallbackData.langPack;

    TRANSLATION_CACHE.clear();

    if (!language) {
      updateLanguage(fallbackData.language);
    } else {
      translationFn = createTranslationFn();
      scheduleCallbacks();
    }
    return fallbackData;
  }).catch((err) => {
    fallbackLoadPromise = undefined;
    // eslint-disable-next-line no-console
    console.warn('Failed to load fallback language:', err);
    return undefined;
  });
  return fallbackLoadPromise;
}

async function fetchDifference() {
  await initialEstablishmentPromise;
  if (!isCurrentTabMaster() || !langPack || !language) return;

  const { langCode, version: fromVersion } = langPack;
  const requestId = languageRequestId;

  try {
    const result = await callApi('fetchLangDifference', {
      langPack: LANG_PACK,
      langCode,
      fromVersion,
    });
    if (!result || requestId !== languageRequestId || langPack.langCode !== langCode) return;
    if (langPack.version !== fromVersion) {
      if (result.langCode === langCode && result.version > langPack.version) void fetchDifference();
      return;
    }

    applyLangPackDifference(result);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Failed to update language:', err);
  }
}

export function applyLangPackDifference({
  langCode, fromVersion, version, strings, keysToRemove,
}: Omit<ApiUpdateLangPack, '@type'>) {
  if (!langPack || !language || langCode !== language.langCode || version <= langPack.version) return;

  if (fromVersion !== langPack.version) {
    void fetchDifference();
    return;
  }

  const newLangPack = {
    ...langPack,
    version,
    strings: {
      ...omit(langPack.strings, keysToRemove),
      ...strings,
    },
  };
  updateLangPack(newLangPack);

  void cacheLangData({
    langPack: newLangPack,
    language,
  });
}

function updateLanguage(newLang: ApiLanguage) {
  language = newLang;
  document.documentElement.lang = newLang.baseLangCode || newLang.langCode;

  createFormatters();

  translationFn = createTranslationFn();

  scheduleCallbacks();
}

function createFormatters() {
  const intlLocale = getIntlLocale();
  const listFormatFallback = getBasicListFormat();

  function createListFormat(lang: string, type: 'conjunction' | 'disjunction') {
    return IS_INTL_LIST_FORMAT_SUPPORTED ? new Intl.ListFormat(lang, { type }) : listFormatFallback;
  }

  try {
    formatters = {
      pluralRules: new Intl.PluralRules(intlLocale),
      region: new Intl.DisplayNames(intlLocale, { type: 'region' }),
      currency: new Intl.DisplayNames(intlLocale, { type: 'currency' }),
      conjunction: createListFormat(intlLocale, 'conjunction'),
      disjunction: createListFormat(intlLocale, 'disjunction'),
      number: new Intl.NumberFormat(intlLocale),
      preciseNumber: new Intl.NumberFormat(intlLocale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 10,
      }),
    };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Failed to create formatters:', e);
    formatters = {
      pluralRules: new Intl.PluralRules(FORMATTERS_FALLBACK_LANG),
      region: new Intl.DisplayNames(FORMATTERS_FALLBACK_LANG, { type: 'region' }),
      currency: new Intl.DisplayNames(FORMATTERS_FALLBACK_LANG, { type: 'currency' }),
      conjunction: createListFormat(FORMATTERS_FALLBACK_LANG, 'conjunction'),
      disjunction: createListFormat(FORMATTERS_FALLBACK_LANG, 'disjunction'),
      number: new Intl.NumberFormat(FORMATTERS_FALLBACK_LANG),
      preciseNumber: new Intl.NumberFormat(FORMATTERS_FALLBACK_LANG, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 10,
      }),
    };
  }

  resetDateFormatCache();
}

function updateLangPack(newLangPack: LangPack | undefined) {
  langPack = newLangPack;

  TRANSLATION_CACHE.clear();
  translationFn = createTranslationFn();

  scheduleCallbacks();
}

export function initLocalization(langCode: string, canLoadFromServer?: boolean) {
  initializationPromise ||= initializeLocalization(langCode, canLoadFromServer);
  return initializationPromise;
}

async function initializeLocalization(langCode: string, canLoadFromServer?: boolean) {
  const requestId = ++languageRequestId;
  const cachedDataPromise = loadCachedLangData(langCode);
  await loadFallbackPack();
  // Initial strings keep startup usable if the full fallback asset is unavailable
  localizationReady.resolve();

  const cachedData = await cachedDataPromise;
  if (requestId !== languageRequestId) return;
  if (cachedData) {
    updateLangPack(cachedData.langPack);
    updateLanguage(cachedData.language);
    void fetchDifference();
  } else if (canLoadFromServer) {
    void loadAndChangeLanguage(langCode);
  }
}

export async function refreshFromCache(langCode: string) {
  if (language?.langCode !== langCode) return;

  const requestId = languageRequestId;
  const cachedData = await loadCachedLangData(langCode);
  if (!cachedData || requestId !== languageRequestId || language.langCode !== langCode
    || (langPack && cachedData.langPack.version <= langPack.version)) return;

  updateLangPack(cachedData.langPack);
  updateLanguage(cachedData.language);
}

export function loadAndChangeLanguage(langCode: string): Promise<boolean> {
  return selectLanguage(langCode);
}

export function retryLocalization(langCode: string): Promise<boolean> {
  void loadFallbackPack();
  if (selectionPromise) return selectionPromise;
  if (langPack && language?.langCode === langCode) {
    void fetchDifference();
    return Promise.resolve(true);
  }
  return loadAndChangeLanguage(langCode);
}

export function requestLangPackDifference(langCode: string) {
  if (language?.langCode !== langCode) return;
  void fetchDifference();
}

export function changeLanguage(newLanguage: ApiLanguage): Promise<boolean> {
  return selectLanguage(newLanguage.langCode, newLanguage);
}

function selectLanguage(langCode: string, newLanguage?: ApiLanguage): Promise<boolean> {
  const requestId = ++languageRequestId;
  const promise = loadLanguage(langCode, requestId, newLanguage);
  selectionPromise = promise;
  void promise.finally(() => {
    if (selectionPromise === promise) selectionPromise = undefined;
  });
  return promise;
}

async function loadLanguage(langCode: string, requestId: number, newLanguage?: ApiLanguage): Promise<boolean> {
  if (langPack && language?.langCode === langCode) return true;

  const cachedData = await loadCachedLangData(langCode);
  if (requestId !== languageRequestId) return false;
  if (cachedData) {
    updateLangPack(cachedData.langPack);
    updateLanguage(cachedData.language);
    void fetchDifference();
    return true;
  }

  await initialEstablishmentPromise;
  if (requestId !== languageRequestId) return false;

  try {
    const remoteLanguage = newLanguage || await callApi('fetchLanguage', { langPack: LANG_PACK, langCode });
    if (requestId !== languageRequestId) return false;
    if (!remoteLanguage || remoteLanguage.langCode !== langCode) return activateFallbackLanguage(langCode, requestId);

    const remoteLangPack = await callApi('fetchLangPack', { langPack: LANG_PACK, langCode });
    if (requestId !== languageRequestId) return false;
    if (!remoteLangPack || remoteLangPack.langCode !== langCode) return activateFallbackLanguage(langCode, requestId);

    const data: CachedLangData = {
      language: remoteLanguage,
      langPack: {
        langCode,
        version: remoteLangPack.version,
        strings: remoteLangPack.strings,
      },
    };
    const cachedRemoteData = await cacheLangData(data);
    if (requestId !== languageRequestId) return false;
    if (langPack?.langCode === langCode && langPack.version > cachedRemoteData.langPack.version) return true;

    updateLangPack(cachedRemoteData.langPack);
    updateLanguage(cachedRemoteData.language);
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Failed to change language:', err);
    return activateFallbackLanguage(langCode, requestId);
  }
}

async function activateFallbackLanguage(langCode: string, requestId: number): Promise<boolean> {
  if (langCode !== FALLBACK_LANG_CODE) return false;
  const fallbackData = await loadFallbackPack();
  if (requestId !== languageRequestId) return false;
  if (language?.langCode === langCode && langPack) return true;
  if (!fallbackData) return false;
  updateLangPack(undefined);
  updateLanguage(fallbackData.language);
  return true;
}

function createTranslationFn(): LangFn {
  const fn: LangFn = ((
    key: LangKey,
    variables: LangFnParameters['variables'],
    options: LangFnOptions | AdvancedLangFnOptions | undefined,
  ) => {
    if (options && areAdvancedLangFnOptions(options)) {
      return processTranslationAdvanced(key, variables as Record<string, TeactNode>, options);
    }
    return processTranslation(key, variables as Record<string, string | number>, options);
  }) as LangFn;
  fn.rawCode = language?.langCode || FORMATTERS_FALLBACK_LANG;
  fn.isRtl = language?.isRtl;
  fn.code = language?.pluralCode || FORMATTERS_FALLBACK_LANG;
  fn.timeFormat = currentTimeFormat;
  fn.with = ({ key, variables, options }: LangFnParameters) => {
    if (options && areAdvancedLangFnOptions(options)) {
      return processTranslationAdvanced(key, variables as Record<string, TeactNode | undefined>, options);
    }
    return processTranslation(key, variables as Record<string, LangVariable>, options);
  };
  fn.withRegular = ({ key, variables, options }: RegularLangFnParameters) => {
    return processTranslation(key, variables, options);
  };
  fn.withAdvanced = ({ key, variables, options }: AdvancedLangFnParameters) => {
    return processTranslationAdvanced(key, variables, options);
  };
  fn.region = (code: string) => formatters?.region.of(code);
  fn.currency = (code: string) => formatters?.currency.of(code);
  fn.conjunction = (list: string[]) => formatters?.conjunction.format(list) || list.join(', ');
  fn.disjunction = (list: string[]) => formatters?.disjunction.format(list) || list.join(', ');
  fn.number = (value: number) => formatters?.number.format(value) || String(value);
  fn.preciseNumber = (value: number) => formatters?.preciseNumber.format(value) || String(value);
  fn.internalFormatters = formatters!;
  fn.languageInfo = language;
  return fn;
}

export function getTranslationFn(): LangFn {
  return translationFn;
}

export function setTimeFormat(timeFormat: TimeFormat) {
  if (timeFormat === currentTimeFormat) {
    return;
  }

  currentTimeFormat = timeFormat;
  resetDateFormatCache();
  translationFn = createTranslationFn();
  scheduleCallbacks();
}

function getIntlLocale(languageInfo = language) {
  return languageInfo?.pluralCode || FORMATTERS_FALLBACK_LANG;
}

function getString(langKey: LangKey, count: number) {
  const shouldForceFallback = FORCE_FALLBACK_LANG && language?.langCode === FALLBACK_LANG_CODE;
  let langPackStringValue = !shouldForceFallback ? langPack?.strings[langKey] : undefined;
  if (langPackStringValue && isDeletedLangString(langPackStringValue)) langPackStringValue = undefined;
  const shouldUseFallback = !langPackStringValue;

  if (!langPackStringValue && !fallbackLangPack) {
    loadFallbackPack();
  }

  langPackStringValue ||= fallbackLangPack?.strings[langKey];
  langPackStringValue ||= initialStrings[langKey];

  if (!langPackStringValue || isDeletedLangString(langPackStringValue)) return undefined;

  const pluralSuffix = (shouldUseFallback ? FALLBACK_PLURAL_RULES : formatters.pluralRules).select(count);

  const string = isPluralLangString(langPackStringValue)
    ? (langPackStringValue[pluralSuffix] || langPackStringValue.other)
    : langPackStringValue;

  return string;
}

function processTranslation(
  langKey: LangKey,
  variables?: Record<string, LangVariable | RegularLangFnParameters>,
  options?: LangFnOptions | LangFnOptionsWithPlural,
): string {
  const isCacheable = !options?.withNodes;
  const cacheKey = isCacheable ? `${langKey}-${JSON.stringify(variables)}-${JSON.stringify(options)}` : undefined;
  if (cacheKey) {
    if (TRANSLATION_CACHE.has(cacheKey)) {
      return TRANSLATION_CACHE.get(cacheKey)!;
    }
  }

  const pluralValue = options && 'pluralValue' in options ? Number(options.pluralValue) : 0;
  const string = getString(langKey, pluralValue);

  if (!string) return langKey;

  const variableEntries = variables ? Object.entries(variables) : [];
  const finalString = variableEntries.reduce((result, [key, value]) => {
    if (value === undefined) return result;
    if (typeof value === 'object') { // Allow recursive variables in basic `lang.with`
      value = processTranslation(value.key, value.variables, value.options);
    }

    const valueAsString = Number.isFinite(value) ? formatters!.number.format(value as number) : String(value);
    return result.replaceAll(`{${key}}`, () => valueAsString);
  }, string);

  if (cacheKey) {
    TRANSLATION_CACHE.set(cacheKey, finalString);
  }

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

  let tempResult: TeactNode = string;
  if (options?.specialReplacement) {
    const specialReplacements = Object.entries(options.specialReplacement);
    tempResult = specialReplacements.reduce((acc, [key, value]) => {
      return replaceInStringsWithTeact(acc, key, value);
    }, tempResult as TeactNode);
  }

  const withRenderText = options?.withNodes;

  if (withRenderText) {
    const filters = unique<TextFilter>(['emoji', ...options.renderTextFilters || []]);

    function renderPart(part: string): TeactNode {
      const replaced = variableEntries.reduce((result, [key, value]): TeactNode => {
        if (value === undefined) return result;

        const preparedValue = Number.isFinite(value) ? formatters.number.format(value as number) : value;
        return replaceInStringsWithTeact(result, `{${key}}`, preparedValue);
      }, part as TeactNode);
      const parts = Array.isArray(replaced) ? replaced : [replaced];
      return parts.flatMap((value) => typeof value === 'string' ? renderText(value, filters) : value);
    }

    const tempResultArray = Array.isArray(tempResult) ? tempResult : [tempResult];
    return tempResultArray.flatMap((curr: TeactNode) => {
      if (typeof curr !== 'string') {
        return curr;
      }

      return options.withMarkdown
        ? renderText(curr, ['simple_markdown'], { markdownPostProcessor: renderPart })
        : renderPart(curr);
    });
  }

  return variableEntries.reduce((result, [key, value]): TeactNode => {
    if (value === undefined) return result;

    const preparedValue = Number.isFinite(value) ? formatters!.number.format(value as number) : value;
    return replaceInStringsWithTeact(result, `{${key}}`, renderText(preparedValue));
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
  RegularLangFnParameters,
  AdvancedLangFnParameters,
};
