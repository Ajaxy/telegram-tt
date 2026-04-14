import type { TimeFormat } from '../../types';
import type { LangFn } from './types';

import { FALLBACK_LANG_CODE } from '../../config';

import LimitedMap from '../primitives/LimitedMap';

type DateStyle = 'short' | 'long' | 'numeric' | false;
type TimeStyle = 'short' | 'long' | false;
type WeekdayStyle = 'short' | 'long' | boolean;
type RelativeUnit = 'minute' | 'hour' | 'day';
type RelativeType = 'numeric' | 'auto';
type RelativePart = { unit: RelativeUnit; value: number };

export interface FormatDateTimeOptions {
  date?: DateStyle;
  time?: TimeStyle;
  weekday?: WeekdayStyle;
  /**
   * The type of relative time formatting to use.
   * - 'numeric' uses the numeric format (e.g. "1 day ago", "2 weeks ago").
   * - 'auto' output may use more idiomatic phrasing such as "yesterday".
   */
  relative?: RelativeType;
  /**
   * The date to use as the anchor for relative formatting. Usually the current date.
   */
  anchorDate?: Date;
  includeYear?: boolean;
  includeDay?: boolean;
}

export interface FormatMessageListDateOptions {
  anchorDate?: Date;
}

const RESULT_CACHE_LIMIT = 200;
const DAY_IN_SECONDS = 24 * 60 * 60;

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();
const relativeTimeFormatters = new Map<string, Intl.RelativeTimeFormat>();
const resultCache = new LimitedMap<string, string>(RESULT_CACHE_LIMIT);

export function resetDateFormatCache() {
  dateTimeFormatters.clear();
  relativeTimeFormatters.clear();
  resultCache.clear();
}

export function formatDateTime(lang: LangFn, date: Date, options: FormatDateTimeOptions = {}) {
  if (options.relative) {
    const relative = formatRelativeDateTime(
      lang, date, options.anchorDate, options.relative);
    if (relative) {
      return relative;
    }
  }

  return formatAbsoluteDateTime(lang, date, options);
}

export function formatMessageListDate(
  lang: LangFn,
  date: Date,
  options: FormatMessageListDateOptions = {},
) {
  const anchorDate = options.anchorDate || new Date();
  const calendarDayDiff = getCalendarDayDiff(date, anchorDate);

  if (calendarDayDiff === 0) {
    return lang('WeekdayToday');
  }

  if (calendarDayDiff === -1) {
    return lang('WeekdayYesterday');
  }

  if (date.getFullYear() !== anchorDate.getFullYear()) {
    return formatDateTime(lang, date, { date: 'long' });
  }

  if (Math.abs(calendarDayDiff) < 7) {
    return formatDateTime(lang, date, { weekday: 'long' });
  }

  return formatDateTime(lang, date, {
    date: 'long',
    includeYear: false,
  });
}

function formatAbsoluteDateTime(lang: LangFn, date: Date, options: FormatDateTimeOptions) {
  const intlOptions = buildAbsoluteFormatterOptions(lang, options);
  const cacheKey = [
    'formatDateTime',
    lang.code,
    lang.timeFormat,
    date.getTime(),
    serializeRecord({
      date: options.date ?? false,
      time: options.time ?? false,
      weekday: options.weekday,
      includeYear: options.includeYear,
      includeDay: options.includeDay,
    }),
  ].join(':');

  return getCachedResult(cacheKey, () => {
    return getDateTimeFormatter(lang.code, lang.timeFormat, intlOptions).format(date);
  });
}

function formatRelativeDateTime(
  lang: LangFn,
  targetDate: Date,
  anchorDate: Date = new Date(),
  type: RelativeType = 'numeric',
) {
  if (type === 'auto' && Math.abs(targetDate.getTime() - anchorDate.getTime()) < 60 * 1000) {
    return lang('RightNow');
  }

  const relativePart = getRelativePart(targetDate.getTime(), anchorDate.getTime());

  const cacheKey = [
    'formatRelativeDateTime',
    lang.code,
    type,
    targetDate.getTime() - anchorDate.getTime(),
    relativePart.unit,
    relativePart.value,
  ].join(':');

  return getCachedResult(cacheKey, () => {
    return getRelativeTimeFormatter(lang.code, type).format(relativePart.value, relativePart.unit);
  });
}

export function formatClockDuration(duration: number) {
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = Math.floor(duration % 3600 % 60);

  let string = '';
  if (hours > 0) {
    string += `${String(hours)}:`;
    string += `${String(minutes).padStart(2, '0')}:`;
  } else {
    string += `${String(minutes)}:`;
  }
  string += String(seconds).padStart(2, '0');

  return string;
}

export function formatCountdownDateTime(
  lang: LangFn,
  targetDate: Date,
  options: Pick<FormatDateTimeOptions, 'anchorDate'> = {},
) {
  const anchorDate = options.anchorDate || new Date();
  const diffInSeconds = Math.max(0, Math.trunc((targetDate.getTime() - anchorDate.getTime()) / 1000));

  if (diffInSeconds < DAY_IN_SECONDS) {
    return lang('TimeIn', { time: formatClockDuration(diffInSeconds) });
  }

  return formatDateTime(lang, targetDate, {
    relative: 'auto',
    anchorDate,
  });
}

function buildAbsoluteFormatterOptions(lang: LangFn, options: FormatDateTimeOptions) {
  const dateStyle = options.date ?? false;
  const timeStyle = options.time ?? false;
  const formatterOptions: Intl.DateTimeFormatOptions = {};

  if (options.weekday) {
    formatterOptions.weekday = options.weekday === true ? 'long' : options.weekday;
  }

  if (dateStyle) {
    formatterOptions.month = dateStyle;
    formatterOptions.day = options.includeDay === false ? undefined : 'numeric';
    formatterOptions.year = options.includeYear === false ? undefined : 'numeric';
  }

  if (timeStyle) {
    formatterOptions.hour = '2-digit';
    formatterOptions.minute = '2-digit';
    formatterOptions.second = timeStyle === 'long' ? '2-digit' : undefined;
    formatterOptions.hourCycle = getHourCycle(lang.timeFormat);
  }

  if (!dateStyle && !timeStyle && !options.weekday) {
    formatterOptions.month = 'numeric';
    formatterOptions.day = 'numeric';
    formatterOptions.year = 'numeric';
  }

  return formatterOptions;
}

function getRelativePart(targetTime: number, anchorTime: number): RelativePart {
  const diffInSeconds = Math.trunc((targetTime - anchorTime) / 1000);
  const absDiffInSeconds = Math.abs(diffInSeconds);

  if (absDiffInSeconds < 60 * 60) {
    return { unit: 'minute' as const, value: Math.trunc(diffInSeconds / 60) };
  }

  if (absDiffInSeconds < DAY_IN_SECONDS) {
    return { unit: 'hour' as const, value: Math.trunc(diffInSeconds / (60 * 60)) };
  }

  return {
    unit: 'day' as const,
    value: getCalendarDayDiff(new Date(targetTime), new Date(anchorTime)),
  };
}

function getDateTimeFormatter(locale: string, timeFormat: TimeFormat, options: Intl.DateTimeFormatOptions) {
  const key = `dateTime:${locale}:${timeFormat}:${serializeRecord(options)}`;
  const cachedFormatter = dateTimeFormatters.get(key);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = createDateTimeFormatter(locale, timeFormat, options);
  dateTimeFormatters.set(key, formatter);
  return formatter;
}

function createDateTimeFormatter(locale: string, timeFormat: TimeFormat, options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat(locale, {
      ...options,
      hourCycle: options.hour ? getHourCycle(timeFormat) : options.hourCycle,
    });
  } catch {
    return new Intl.DateTimeFormat(FALLBACK_LANG_CODE, {
      ...options,
      hourCycle: options.hour ? getHourCycle(timeFormat) : options.hourCycle,
    });
  }
}

function getRelativeTimeFormatter(locale: string, numericType: RelativeType) {
  const key = `relative:${locale}:${numericType}`;
  const cachedFormatter = relativeTimeFormatters.get(key);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = createRelativeTimeFormatter(locale, numericType);
  relativeTimeFormatters.set(key, formatter);
  return formatter;
}

function createRelativeTimeFormatter(locale: string, numericType: RelativeType) {
  const numeric = numericType === 'numeric' ? 'always' : 'auto';
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric });
  } catch {
    return new Intl.RelativeTimeFormat(FALLBACK_LANG_CODE, { numeric });
  }
}

function getCachedResult(cacheKey: string, callback: () => string) {
  const cachedResult = resultCache.get(cacheKey);
  if (cachedResult !== undefined) {
    return cachedResult;
  }

  const newResult = callback();
  resultCache.set(cacheKey, newResult);
  return newResult;
}

function getHourCycle(timeFormat: TimeFormat) {
  return timeFormat === '12h' ? 'h12' : 'h23';
}

export function secondsToDate(seconds: number) {
  return new Date(seconds * 1000);
}

export function getCalendarDayDiff(targetDate: Date, anchorDate: Date) {
  return Math.trunc(
    (
      Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
      - Date.UTC(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate())
    ) / (DAY_IN_SECONDS * 1000),
  );
}

function serializeRecord(record: object) {
  return Object.entries(record as Record<string, unknown>)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&');
}
