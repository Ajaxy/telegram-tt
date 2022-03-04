import { LangFn } from '../hooks/useLang';

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
  return getDayStart(new Date()) === getDayStart(date);
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
export function formatTime(lang: LangFn, datetime: number | Date) {
  const date = typeof datetime === 'number' ? new Date(datetime) : datetime;
  const timeFormat = lang.timeFormat || '24h';

  let hours = date.getHours();
  let marker = '';
  if (timeFormat === '12h') {
    marker = hours >= 12 ? ' PM' : ' AM';
    hours = hours > 12 ? hours % 12 : hours;
  }

  return `${String(hours).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}${marker}`;
}

export function formatPastTimeShort(lang: LangFn, datetime: number | Date) {
  const date = typeof datetime === 'number' ? new Date(datetime) : datetime;

  const today = getDayStart(new Date());
  if (date >= today) {
    return formatTime(lang, date);
  }

  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  if (date >= weekAgo) {
    return lang(`Weekday.Short${WEEKDAYS_FULL[date.getDay()]}`);
  }

  const withYear = date.getFullYear() !== today.getFullYear();
  const format = (
    lang(withYear ? 'formatDateScheduleYear' : 'formatDateSchedule')
    || (withYear ? 'd MMM yyyy' : 'd MMM')
  );

  return formatDate(lang, date, format);
}

export function formatFullDate(lang: LangFn, datetime: number | Date) {
  const date = typeof datetime === 'number' ? new Date(datetime) : datetime;
  const format = lang('formatterYearMax') || 'dd.MM.yyyy';

  return formatDate(lang, date, format);
}

export function formatMonthAndYear(lang: LangFn, date: Date, isShort = false) {
  const format = lang(isShort ? 'formatterMonthYear2' : 'formatterMonthYear') || 'MMM yyyy';

  return formatDate(lang, date, format);
}

export function formatCountdown(
  lang: LangFn,
  msLeft: number,
) {
  const days = Math.floor(msLeft / MILLISECONDS_IN_DAY);
  if (msLeft < 0) {
    return 0;
  } else if (days < 1) {
    return formatMediaDuration(msLeft / 1000);
  } else if (days < 7) {
    return lang('Days', days);
  } else if (days < 30) {
    return lang('Weeks', Math.floor(days / 7));
  } else if (days < 365) {
    return lang('Months', Math.floor(days / 30));
  } else {
    return lang('Years', Math.floor(days / 365));
  }
}

export function formatCountdownShort(lang: LangFn, msLeft: number) {
  if (msLeft < 60 * 1000) {
    return Math.ceil(msLeft / 1000);
  } else if (msLeft < 60 * 60 * 1000) {
    return Math.ceil(msLeft / (60 * 1000));
  } else if (msLeft < MILLISECONDS_IN_DAY) {
    return lang('MessageTimer.ShortHours', Math.ceil(msLeft / (60 * 60 * 1000)));
  } else {
    return lang('MessageTimer.ShortDays', Math.ceil(msLeft / MILLISECONDS_IN_DAY));
  }
}

export function formatLastUpdated(lang: LangFn, currentTime: number, lastUpdated = currentTime) {
  const seconds = currentTime - lastUpdated;
  if (seconds < 60) {
    return lang('LiveLocationUpdated.JustNow');
  } else if (seconds < 60 * 60) {
    return lang('LiveLocationUpdated.MinutesAgo', Math.floor(seconds / 60));
  } else {
    return lang('LiveLocationUpdated.TodayAt', formatTime(lang, lastUpdated));
  }
}

export function formatHumanDate(
  lang: LangFn,
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

    const weekAgo = new Date(today);
    const weekAhead = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    weekAhead.setDate(today.getDate() + 7);
    if (date >= weekAgo && date <= weekAhead) {
      const weekDay = WEEKDAYS_FULL[date.getDay()];
      const weekDayString = isShort ? lang(`Weekday.Short${weekDay}`) : lang(`Weekday.${weekDay}`);

      return (isUpperFirst || !isShort ? upperFirst : lowerFirst)(weekDayString);
    }
  }

  const withYear = date.getFullYear() !== today.getFullYear();
  const formatKey = isShort
    ? (withYear ? 'formatDateScheduleYear' : 'formatDateSchedule')
    : (withYear ? 'chatFullDate' : 'chatDate');
  const format = lang(formatKey) || 'd MMMM yyyy';

  return (isUpperFirst || !isShort ? upperFirst : lowerFirst)(formatDate(lang, date, format));
}

function formatDate(lang: LangFn, date: Date, format: string) {
  const day = date.getDate();
  const monthIndex = date.getMonth();

  return format
    .replace('LLLL', lang(MONTHS_FULL[monthIndex]))
    .replace('MMMM', lang(`Month.Gen${MONTHS_FULL[monthIndex]}`))
    .replace('MMM', lang(`Month.Short${MONTHS_FULL[monthIndex]}`))
    .replace('MM', String(monthIndex + 1).padStart(2, '0'))
    .replace('dd', String(day).padStart(2, '0'))
    .replace('d', String(day))
    .replace('yyyy', String(date.getFullYear()))
    // Workaround for https://bugs.telegram.org/c/5777
    .replace(/'de'/g, 'de');
}

export function formatMediaDateTime(
  lang: LangFn,
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

export function formatDateToString(datetime: Date | number, locale = 'en-US') {
  const date = typeof datetime === 'number' ? new Date(datetime) : datetime;
  return date.toLocaleString(
    locale,
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    },
  );
}

export function formatDateTimeToString(datetime: Date | number, locale = 'en-US') {
  const date = typeof datetime === 'number' ? new Date(datetime) : datetime;
  return date.toLocaleString(
    locale,
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    },
  );
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
