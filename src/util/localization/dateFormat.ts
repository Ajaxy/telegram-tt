import type { TimeFormat } from '../../types';
import type { LangFn } from './types';

import { formatClockDuration } from '../dates/duration';
import {
  DAY, HOUR, MINUTE, MONTH, YEAR,
} from '../dates/units';
import { getServerTime } from '../serverTime';

import LimitedMap from '../primitives/LimitedMap';

const FALLBACK_LANG_CODE = 'en';

type DateStyle = 'short' | 'long' | 'numeric' | false;
type TimeStyle = 'short' | 'long' | false;
type WeekdayStyle = 'short' | 'long' | boolean;
type RelativeUnit = 'minute' | 'hour' | 'day' | 'month' | 'year';
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

interface AnchorDateOptions {
  anchorDate?: Date;
}

interface FormatRecentTimestampOptions extends AnchorDateOptions {
  context?: 'generic' | 'lastSeen' | 'location';
}

interface FormatCompactTimestampOptions extends AnchorDateOptions {
  variant?: 'chat' | 'poll';
  withTime?: boolean;
}

interface FormatCalendarDateOptions extends AnchorDateOptions {
  variant?: 'calendar' | 'date' | 'absolute' | 'joinRequest';
  isShort?: boolean;
  withTime?: boolean;
}

type AbsoluteDateTimeFormatOptions = Pick<
  Intl.DateTimeFormatOptions,
  'weekday' | 'month' | 'day' | 'year' | 'hour' | 'minute' | 'second' | 'hourCycle'
>;

type DateTimeResultCacheOptions = {
  date: DateStyle;
  time: TimeStyle;
  weekday?: WeekdayStyle;
  includeYear?: boolean;
  includeDay?: boolean;
};

type DateFormatCacheOptions = AbsoluteDateTimeFormatOptions | DateTimeResultCacheOptions;

const RESULT_CACHE_LIMIT = 200;
const MILLISECONDS_IN_SECOND = 1000;
const RECENT_HOURS = 12;
const WEEKDAYS_IN_CALENDAR_WINDOW = 6;
const WEEKDAYS_IN_CHAT_WINDOW = 7;
const SUNDAY = new Date(2023, 0, 1);

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
  options: AnchorDateOptions = {},
) {
  const anchorDate = options.anchorDate || getAnchorDate();
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

  if (Math.abs(calendarDayDiff) <= WEEKDAYS_IN_CALENDAR_WINDOW) {
    return formatDateTime(lang, date, { weekday: 'long' });
  }

  return formatDateTime(lang, date, {
    date: 'long',
    includeYear: false,
  });
}

export function formatRelativeAge(lang: LangFn, date: Date, options: AnchorDateOptions = {}) {
  const anchorDate = options.anchorDate || getAnchorDate();
  const seconds = getPastSeconds(date, anchorDate);
  if (seconds < MINUTE) {
    return lang('JustNowAgo');
  }

  const unit: RelativeUnit = seconds < HOUR ? 'minute'
    : seconds < DAY ? 'hour'
      : seconds < MONTH ? 'day'
        : seconds < YEAR ? 'month' : 'year';
  const divisor = unit === 'minute' ? MINUTE : unit === 'hour' ? HOUR
    : unit === 'day' ? DAY : unit === 'month' ? MONTH : YEAR;
  return getRelativeTimeFormatter(lang.code, 'numeric').format(-Math.floor(seconds / divisor), unit);
}

export function formatRecentTimestamp(lang: LangFn, date: Date, options: FormatRecentTimestampOptions = {}) {
  const anchorDate = options.anchorDate || getAnchorDate();
  const { context = 'generic' } = options;
  const seconds = getPastSeconds(date, anchorDate);
  if (seconds < MINUTE) {
    return lang(context === 'lastSeen' ? 'LastSeenJustNow'
      : context === 'location' ? 'LiveLocationUpdatedJustNow' : 'JustNowAgo');
  }
  if (seconds < HOUR) {
    const count = Math.floor(seconds / MINUTE);
    if (context === 'generic') {
      return getRelativeTimeFormatter(lang.code, 'numeric').format(-count, 'minute');
    }
    return lang(context === 'lastSeen' ? 'LastSeenMinutesAgo' : 'LiveLocationUpdatedMinutesAgo',
      { count }, { pluralValue: count });
  }
  if (seconds < RECENT_HOURS * HOUR) {
    const count = Math.floor(seconds / HOUR);
    if (context === 'generic') {
      return getRelativeTimeFormatter(lang.code, 'numeric').format(-count, 'hour');
    }
    return lang(context === 'lastSeen' ? 'LastSeenHoursAgo' : 'LiveLocationUpdatedHoursAgo',
      { count }, { pluralValue: count });
  }

  const calendarDayDiff = getCalendarDayDiff(date, anchorDate);
  const isSameYear = date.getFullYear() === anchorDate.getFullYear();
  const time = formatDateTime(lang, date, { time: 'short' });
  if (calendarDayDiff === 0 || calendarDayDiff === -1) {
    if (context === 'lastSeen') {
      return lang(calendarDayDiff === 0 ? 'LastSeenTodayAt' : 'LastSeenYesterdayAt', { time });
    }
    if (context === 'location') {
      return lang(calendarDayDiff === 0 ? 'LiveLocationUpdatedTodayAt' : 'LiveLocationUpdatedYesterdayAt', { time });
    }
    return lang('FormatDateAtTime', {
      date: getRelativeTimeFormatter(lang.code, 'auto').format(calendarDayDiff, 'day'), time,
    });
  }

  const dateTime = formatDateTime(lang, date, { date: 'short', time: 'short', includeYear: !isSameYear });
  return context === 'generic' ? dateTime
    : lang(context === 'lastSeen' ? 'LastSeenAtDate' : 'LiveLocationUpdatedAtDate', { date: dateTime });
}

export function formatCompactTimestamp(lang: LangFn, date: Date, options: FormatCompactTimestampOptions = {}) {
  const anchorDate = options.anchorDate || getAnchorDate();
  const calendarDayDiff = getCalendarDayDiff(date, anchorDate);
  const isPoll = options.variant === 'poll';
  if (calendarDayDiff === 0 || (!isPoll && calendarDayDiff > 0)) {
    return formatDateTime(lang, date, { time: 'short' });
  }

  const isWeekday = isPoll ? Math.abs(calendarDayDiff) <= WEEKDAYS_IN_CALENDAR_WINDOW
    : calendarDayDiff >= -WEEKDAYS_IN_CHAT_WINDOW;
  if (isWeekday) {
    return formatDateTime(lang, date, { weekday: 'short', time: options.withTime ? 'short' : undefined });
  }

  return formatDateTime(lang, date, {
    date: isPoll ? 'numeric' : 'short',
    time: options.withTime ? 'short' : undefined,
    includeYear: date.getFullYear() !== anchorDate.getFullYear(),
  });
}

export function formatCalendarDate(lang: LangFn, date: Date, options: FormatCalendarDateOptions = {}) {
  const anchorDate = options.anchorDate || getAnchorDate();
  const { variant = 'calendar', isShort, withTime } = options;
  const calendarDayDiff = getCalendarDayDiff(date, anchorDate);
  if (variant === 'joinRequest' && calendarDayDiff === 0) {
    return formatDateTime(lang, date, { time: 'short' });
  }
  if (variant !== 'absolute' && (calendarDayDiff === 0 || calendarDayDiff === -1)) {
    const relativeDay = getRelativeTimeFormatter(lang.code, 'auto').format(calendarDayDiff, 'day');
    return withTime ? lang('FormatDateAtTime', {
      date: relativeDay, time: formatDateTime(lang, date, { time: 'short' }),
    }) : relativeDay;
  }
  if ((variant === 'calendar' || variant === 'joinRequest')
    && Math.abs(calendarDayDiff) <= WEEKDAYS_IN_CALENDAR_WINDOW) {
    return formatDateTime(lang, date, {
      weekday: isShort ? 'short' : 'long', time: withTime ? 'short' : undefined,
    });
  }
  return formatDateTime(lang, date, {
    date: isShort ? 'short' : 'long', time: withTime ? 'short' : undefined,
    includeYear: date.getFullYear() !== anchorDate.getFullYear(),
  });
}

export function formatWeekday(lang: LangFn, day: number, isShort?: boolean) {
  const date = new Date(SUNDAY);
  date.setDate(date.getDate() + day);
  return formatDateTime(lang, date, { weekday: isShort ? 'short' : 'long' });
}

export function formatRegistrationMonth(lang: LangFn, dateString: string) {
  const [month, year] = dateString.split('.').map(Number);
  return formatDateTime(lang, new Date(year, month - 1), { date: 'long', includeDay: false });
}

function formatAbsoluteDateTime(lang: LangFn, date: Date, options: FormatDateTimeOptions) {
  const intlOptions = buildAbsoluteFormatterOptions(lang, options);
  const cacheKey = [
    'formatDateTime',
    lang.code,
    lang.timeFormat,
    date.getTime(),
    serializeDateFormatOptions({
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
  anchorDate: Date = getAnchorDate(),
  type: RelativeType = 'numeric',
) {
  if (type === 'auto' && Math.abs(targetDate.getTime() - anchorDate.getTime()) < MINUTE * MILLISECONDS_IN_SECOND) {
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

export function formatCountdownDateTime(
  lang: LangFn,
  targetDate: Date,
  options: Pick<FormatDateTimeOptions, 'anchorDate'> = {},
) {
  const anchorDate = options.anchorDate || getAnchorDate();
  const diffInSeconds = Math.max(0, Math.trunc((targetDate.getTime() - anchorDate.getTime()) / MILLISECONDS_IN_SECOND));

  if (diffInSeconds < DAY) {
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
  const formatterOptions: AbsoluteDateTimeFormatOptions = {};

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
  const diffInSeconds = Math.trunc((targetTime - anchorTime) / MILLISECONDS_IN_SECOND);
  const absDiffInSeconds = Math.abs(diffInSeconds);

  if (absDiffInSeconds < HOUR) {
    return { unit: 'minute', value: Math.trunc(diffInSeconds / MINUTE) };
  }

  if (absDiffInSeconds < DAY) {
    return { unit: 'hour', value: Math.trunc(diffInSeconds / HOUR) };
  }

  return {
    unit: 'day',
    value: getCalendarDayDiff(new Date(targetTime), new Date(anchorTime)),
  };
}

function getDateTimeFormatter(locale: string, timeFormat: TimeFormat, options: AbsoluteDateTimeFormatOptions) {
  const key = `dateTime:${locale}:${timeFormat}:${serializeDateFormatOptions(options)}`;
  const cachedFormatter = dateTimeFormatters.get(key);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = createDateTimeFormatter(locale, timeFormat, options);
  dateTimeFormatters.set(key, formatter);
  return formatter;
}

function createDateTimeFormatter(locale: string, timeFormat: TimeFormat, options: AbsoluteDateTimeFormatOptions) {
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
  return new Date(seconds * MILLISECONDS_IN_SECOND);
}

function getAnchorDate() {
  return secondsToDate(getServerTime());
}

function getPastSeconds(date: Date, anchorDate: Date) {
  return Math.max(0, (anchorDate.getTime() - date.getTime()) / MILLISECONDS_IN_SECOND);
}

export function isSameLocalDay(leftDate: Date, rightDate: Date) {
  return leftDate.getDate() === rightDate.getDate()
    && leftDate.getMonth() === rightDate.getMonth()
    && leftDate.getFullYear() === rightDate.getFullYear();
}

export function getCalendarDayDiff(targetDate: Date, anchorDate: Date) {
  return Math.trunc(
    (
      Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
      - Date.UTC(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate())
    ) / (DAY * MILLISECONDS_IN_SECOND),
  );
}

function serializeDateFormatOptions(options: DateFormatCacheOptions) {
  return Object.entries(options)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&');
}
