import type { OldLangFn } from '../../hooks/useOldLang';
import type { TimeFormat } from '../../types';
import type { LangFn } from '../localization';

import withCache from '../withCache';
import { getDays } from './units';

const WEEKDAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_FULL_LOWERCASE = MONTHS_FULL.map((month) => month.toLowerCase());
const MIN_SEARCH_YEAR = 2015;
const MAX_DAY_IN_MONTH = 31;
const MAX_MONTH_IN_YEAR = 12;
export const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

export function isToday(date: Date) {
  return getDayStartAt(new Date()) === getDayStartAt(date);
}

export function getDayStart(datetime: number | Date) {
  const date = new Date(datetime);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getDayStartAt(datetime: number | Date) {
  return getDayStart(datetime).getTime();
}

export function toYearMonth(timestamp: number) {
  const date = new Date(timestamp * 1000);
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function toIsoString(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// @optimization `toLocaleTimeString` is avoided because of bad performance
export function formatTime(lang: OldLangFn, datetime: number | Date) {
  const date = typeof datetime === 'number' ? new Date(datetime) : datetime;
  const timeFormat = lang.timeFormat || '24h';

  let hours = date.getHours();
  let marker = '';
  if (timeFormat === '12h') {
    marker = hours >= 12 ? '\xa0PM' : '\xa0AM'; // NBSP
    hours = hours > 12 ? hours % 12 : hours;
  }

  return `${String(hours).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}${marker}`;
}

export function formatPastTimeShort(lang: OldLangFn, datetime: number | Date, alwaysShowTime = false) {
  const date = typeof datetime === 'number' ? new Date(datetime) : datetime;

  const time = formatTime(lang, date);

  const today = getDayStart(new Date());
  if (date >= today) {
    return time;
  }

  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  if (date >= weekAgo) {
    const weekday = lang(`Weekday.Short${WEEKDAYS_FULL[date.getDay()]}`);
    return alwaysShowTime ? lang('FullDateTimeFormat', [weekday, time]) : weekday;
  }

  const noYear = date.getFullYear() === today.getFullYear();

  const formattedDate = formatDateToString(date, lang.code, noYear);
  return alwaysShowTime ? lang('FullDateTimeFormat', [formattedDate, time]) : formattedDate;
}

export function formatFullDate(lang: OldLangFn, datetime: number | Date) {
  return formatDateToString(datetime, lang.code, false, 'numeric');
}

export function formatMonthAndYear(lang: OldLangFn, date: Date, isShort = false) {
  return formatDateToString(date, lang.code, false, isShort ? 'short' : 'long', true);
}

export function formatCountdown(
  lang: LangFn,
  secondsLeft: number,
) {
  const days = getDays(secondsLeft);
  if (secondsLeft < 0) {
    return 0;
  } else if (days < 1) {
    return formatMediaDuration(secondsLeft);
  } else if (days < 7) {
    const count = days;
    return lang('Days', { count }, { pluralValue: count });
  } else if (days < 30) {
    const count = Math.floor(days / 7);
    return lang('Weeks', { count }, { pluralValue: count });
  } else if (days < 365) {
    const count = Math.floor(days / 30);
    return lang('Months', { count }, { pluralValue: count });
  } else {
    const count = Math.floor(days / 365);
    return lang('Years', { count }, { pluralValue: count });
  }
}

export function formatCountdownShort(lang: OldLangFn, msLeft: number): string {
  if (msLeft < 60 * 1000) {
    return Math.ceil(msLeft / 1000).toString();
  } else if (msLeft < 60 * 60 * 1000) {
    return Math.ceil(msLeft / (60 * 1000)).toString();
  } else if (msLeft < MILLISECONDS_IN_DAY) {
    return lang('MessageTimer.ShortHours', Math.ceil(msLeft / (60 * 60 * 1000)));
  } else {
    return lang('MessageTimer.ShortDays', Math.ceil(msLeft / MILLISECONDS_IN_DAY));
  }
}

export function formatLastUpdated(lang: OldLangFn, currentTime: number, lastUpdated = currentTime) {
  const seconds = currentTime - lastUpdated;
  if (seconds < 60) {
    return lang('LiveLocationUpdated.JustNow');
  } else if (seconds < 60 * 60) {
    return lang('LiveLocationUpdated.MinutesAgo', Math.floor(seconds / 60));
  } else {
    return lang('LiveLocationUpdated.TodayAt', formatTime(lang, lastUpdated));
  }
}

export function formatRelativeTime(lang: OldLangFn, currentTime: number, lastUpdated = currentTime) {
  const seconds = currentTime - lastUpdated;

  if (seconds < 60) {
    return lang('Time.JustNow');
  }

  // within an hour
  if (seconds < 60 * 60) {
    return lang('Time.MinutesAgo', Math.floor(seconds / 60));
  }

  const lastUpdatedDate = new Date(lastUpdated * 1000);
  const today = getDayStart(new Date());
  if (lastUpdatedDate >= today) {
    return lang('Time.TodayAt', formatTime(lang, lastUpdatedDate));
  }

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (lastUpdatedDate > yesterday) {
    return lang('Time.YesterdayAt', formatTime(lang, lastUpdatedDate));
  }

  return lang('Time.AtDate', formatFullDate(lang, lastUpdatedDate));
}

type DurationType = 'Seconds' | 'Minutes' | 'Hours' | 'Days' | 'Weeks';

export function formatTimeDuration(lang: OldLangFn, duration: number, showLast = 2) {
  if (!duration) {
    return undefined;
  }

  const durationRecords: { duration: number; type: DurationType }[] = [];
  const labels = [
    { multiplier: 1, type: 'Seconds' },
    { multiplier: 60, type: 'Minutes' },
    { multiplier: 60, type: 'Hours' },
    { multiplier: 24, type: 'Days' },
    { multiplier: 7, type: 'Weeks' },
  ] as Array<{ multiplier: number; type: DurationType }>;
  let t = 1;
  labels.forEach((label, idx) => {
    t *= label.multiplier;

    if (duration < t) {
      return;
    }

    const modulus = labels[idx === (labels.length - 1) ? idx : idx + 1].multiplier!;
    durationRecords.push({
      duration: Math.floor((duration / t) % modulus),
      type: label.type,
    });
  });

  const out = durationRecords.slice(-showLast).reverse();
  for (let i = out.length - 1; i >= 0; --i) {
    if (out[i].duration === 0) {
      out.splice(i, 1);
    }
  }

  // TODO In arabic we don't use "," as delimiter rather we use "and" each time
  return out.map((part) => lang(part.type, part.duration, 'i')).join(', ');
}

export function formatHumanDate(
  lang: OldLangFn,
  datetime: number | Date,
  isShort = false,
  noWeekdays = false,
  isUpperFirst?: boolean,
) {
  const date = typeof datetime === 'number' ? new Date(datetime) : datetime;

  const today = getDayStart(new Date());

  if (!noWeekdays) {
    if (toIsoString(date) === toIsoString(today)) {
      return (isUpperFirst || !isShort ? upperFirst : lowerFirst)(lang('Weekday.Today'));
    }

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (toIsoString(date) === toIsoString(yesterday)) {
      return (isUpperFirst || !isShort ? upperFirst : lowerFirst)(lang('Weekday.Yesterday'));
    }

    const limitBefore = new Date(today);
    limitBefore.setDate(today.getDate() - 6); // Avoid returning same weekday as today
    const limitAhead = new Date(today);
    limitAhead.setDate(today.getDate() + 6);

    if (date >= limitBefore && date <= limitAhead) {
      const weekDayString = formatWeekday(lang, date.getDay(), isShort);
      return (isUpperFirst || !isShort ? upperFirst : lowerFirst)(weekDayString);
    }
  }

  const noYear = date.getFullYear() === today.getFullYear();
  const formattedDate = formatDateToString(date, lang.code, noYear, isShort ? 'short' : 'long');

  return (isUpperFirst || !isShort ? upperFirst : lowerFirst)(formattedDate);
}

/**
 * Returns weekday name
 * @param day 0 - Sunday, 1 - Monday, ...
 */
export function formatWeekday(lang: OldLangFn, day: number, isShort = false) {
  const weekDay = WEEKDAYS_FULL[day];
  return isShort ? lang(`Weekday.Short${weekDay}`) : lang(`Weekday.${weekDay}`);
}

export function formatMediaDateTime(
  lang: OldLangFn,
  datetime: number | Date,
  isUpperFirst?: boolean,
) {
  const date = typeof datetime === 'number' ? new Date(datetime) : datetime;

  return `${formatHumanDate(lang, date, true, undefined, isUpperFirst)}, ${formatTime(lang, date)}`;
}

export function formatMediaDuration(duration: number, maxValue?: number) {
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = Math.floor(duration % 3600 % 60);

  const maxHours = maxValue ? Math.floor(maxValue / 3600) : 0;
  const maxMinutes = maxValue ? Math.floor((maxValue % 3600) / 60) : 0;
  let string = '';
  if (hours > 0 || maxHours > 0) {
    string += `${String(hours).padStart(2, '0')}:`;
    string += `${String(minutes).padStart(2, '0')}:`;
  } else if (maxMinutes >= 10) {
    string += `${String(minutes).padStart(2, '0')}:`;
  } else {
    string += `${String(minutes)}:`;
  }
  string += String(seconds).padStart(2, '0');

  return string;
}

export function formatVoiceRecordDuration(durationInMs: number) {
  const parts = [];

  let milliseconds = durationInMs % 1000;
  durationInMs -= milliseconds;
  milliseconds = Math.floor(milliseconds / 10);

  durationInMs = Math.floor(durationInMs / 1000);
  const seconds = durationInMs % 60;
  durationInMs -= seconds;

  durationInMs = Math.floor(durationInMs / 60);
  const minutes = durationInMs % 60;
  durationInMs -= minutes;

  durationInMs = Math.floor(durationInMs / 60);
  const hours = durationInMs % 60;

  if (hours > 0) {
    parts.push(String(hours).padStart(2, '0'));
  }
  parts.push(String(minutes).padStart(hours > 0 ? 2 : 1, '0'));
  parts.push(String(seconds).padStart(2, '0'));

  return `${parts.join(':')},${String(milliseconds).padStart(2, '0')}`;
}

const formatDayToStringWithCache = withCache((
  dayStartAt: number,
  locale: string,
  noYear?: boolean,
  monthFormat: 'short' | 'long' | 'numeric' = 'short',
  noDay?: boolean,
) => {
  return new Date(dayStartAt).toLocaleString(
    locale,
    {
      year: noYear ? undefined : 'numeric',
      month: monthFormat,
      day: noDay ? undefined : 'numeric',
    },
  );
});

export function formatDateToString(
  datetime: Date | number,
  locale = 'en-US',
  noYear = false,
  monthFormat: 'short' | 'long' | 'numeric' = 'short',
  noDay = false,
) {
  const date = typeof datetime === 'number' ? new Date(datetime) : datetime;
  const dayStartAt = getDayStartAt(date);

  return formatDayToStringWithCache(dayStartAt, locale, noYear, monthFormat, noDay);
}

export function formatDateTimeToString(
  datetime: Date | number, locale = 'en-US', noSeconds?: boolean,
  timeFormat?: TimeFormat,
) {
  const date = typeof datetime === 'number' ? new Date(datetime) : datetime;
  return date.toLocaleString(
    locale,
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: noSeconds ? undefined : 'numeric',
      hourCycle: timeFormat === '12h' ? 'h12' : 'h23',
    },
  );
}

export function formatDateAtTime(
  lang: OldLangFn,
  datetime: number | Date,
) {
  const date = typeof datetime === 'number' ? new Date(datetime) : datetime;

  const today = getDayStart(new Date());
  const time = formatTime(lang, date);

  if (toIsoString(date) === toIsoString(today)) {
    return lang('Time.TodayAt', time);
  }

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (toIsoString(date) === toIsoString(yesterday)) {
    return lang('Time.YesterdayAt', time);
  }

  const noYear = date.getFullYear() === today.getFullYear();
  const formattedDate = formatDateToString(date, lang.code, noYear);

  return lang('formatDateAtTime', [formattedDate, time]);
}

export function formatShortDuration(lang: LangFn, duration: number) {
  if (duration < 0) {
    return lang('RightNow');
  }

  if (duration < 60) {
    const count = Math.ceil(duration);
    return lang('Seconds', { count }, { pluralValue: duration });
  }

  if (duration < 60 * 60) {
    const count = Math.ceil(duration / 60);
    return lang('Minutes', { count }, { pluralValue: count });
  }

  if (duration < 60 * 60 * 24) {
    const count = Math.ceil(duration / (60 * 60));
    return lang('Hours', { count }, { pluralValue: count });
  }

  const count = Math.ceil(duration / (60 * 60 * 24));
  return lang('Days', { count }, { pluralValue: count });
}

function isValidDate(day: number, month: number, year = 2021): boolean {
  if (month > (MAX_MONTH_IN_YEAR - 1) || day > MAX_DAY_IN_MONTH) {
    return false;
  }
  const date = new Date(year, month, day);
  return !Number.isNaN(date.getTime()) && date.getDate() === day;
}

export function parseDateString(query = ''): string | undefined {
  const matchStringDate = query.match(/\d{1,2}\s[a-zA-Z]{3,}/);
  const matchEuropeStringDate = query.match(/[a-zA-Z]{3,}\s\d{1,2}/);
  const matchNumberDate = query.match(/\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?/);
  if (!matchStringDate && !matchNumberDate && !matchEuropeStringDate) {
    return undefined;
  }

  if (matchNumberDate) {
    const [date, month, year] = query.split(/[./-]/).map(Number);
    return !(year && year < MIN_SEARCH_YEAR) && isValidDate(date, month - 1, year || undefined)
      ? `${year ? `${year}-` : ''}${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`
      : undefined;
  }

  const dateParts = query.split(' ');
  const date = matchStringDate ? dateParts[0] : dateParts[1];
  const month = (matchStringDate ? dateParts[1] : dateParts[0]).toLowerCase();
  const monthIndex = MONTHS_FULL_LOWERCASE.findIndex((item) => item.startsWith(month));

  return monthIndex !== -1 && isValidDate(Number(date), monthIndex)
    ? `${String(monthIndex + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`
    : undefined;
}

export function timestampPlusDay(timestamp: number) {
  return timestamp + MILLISECONDS_IN_DAY / 1000;
}

function lowerFirst(str: string) {
  return `${str[0].toLowerCase()}${str.slice(1)}`;
}

function upperFirst(str: string) {
  return `${str[0].toUpperCase()}${str.slice(1)}`;
}
