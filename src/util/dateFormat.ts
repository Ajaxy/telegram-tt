import { getTranslation } from './langProvider';

const WEEKDAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_FULL_LOWERCASE = MONTHS_FULL.map((month) => month.toLowerCase());
const MIN_SEARCH_YEAR = 2015;
const MAX_DAY_IN_MONTH = 31;
const MAX_MONTH_IN_YEAR = 12;
export const MILISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

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

export function formatTime(datetime: number | Date) {
  const date = typeof datetime === 'number' ? new Date(datetime) : datetime;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
}

export function formatPastTimeShort(datetime: number | Date) {
  const date = typeof datetime === 'number' ? new Date(datetime) : datetime;

  const today = getDayStart(new Date());
  if (date >= today) {
    return formatTime(date);
  }

  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  if (date >= weekAgo) {
    return getTranslation(`Weekday.Short${WEEKDAYS_FULL[date.getDay()]}`);
  }

  const withYear = date.getFullYear() !== today.getFullYear();
  const format = (
    getTranslation(withYear ? 'formatDateScheduleYear' : 'formatDateSchedule')
    || (withYear ? 'd MMM yyyy' : 'd MMM')
  );

  return formatDate(date, format);
}

export function formatFullDate(datetime: number | Date) {
  const date = typeof datetime === 'number' ? new Date(datetime) : datetime;
  const format = getTranslation('formatterYearMax') || 'dd.MM.yyyy';

  return formatDate(date, format);
}

export function formatMonthAndYear(date: Date, isShort = false) {
  const format = getTranslation(isShort ? 'formatterMonthYear2' : 'formatterMonthYear') || 'MMM yyyy';

  return formatDate(date, format);
}

export function formatHumanDate(datetime: number | Date, isShort = false, noWeekdays = false) {
  const date = typeof datetime === 'number' ? new Date(datetime) : datetime;

  const today = getDayStart(new Date());

  if (!noWeekdays) {
    if (toIsoString(date) === toIsoString(today)) {
      return (isShort ? lowerFirst : upperFirst)(getTranslation('Weekday.Today'));
    }

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (toIsoString(date) === toIsoString(yesterday)) {
      return (isShort ? lowerFirst : upperFirst)(getTranslation('Weekday.Yesterday'));
    }

    const weekAgo = new Date(today);
    const weekAhead = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    weekAhead.setDate(today.getDate() + 7);
    if (date >= weekAgo && date <= weekAhead) {
      const weekDay = WEEKDAYS_FULL[date.getDay()];
      return isShort
        ? lowerFirst(getTranslation(`Weekday.Short${weekDay}`))
        : upperFirst(getTranslation(`Weekday.${weekDay}`));
    }
  }

  const withYear = date.getFullYear() !== today.getFullYear();
  const formatKey = isShort
    ? (withYear ? 'formatDateScheduleYear' : 'formatDateSchedule')
    : (withYear ? 'chatFullDate' : 'chatDate');
  const format = getTranslation(formatKey) || 'd MMMM yyyy';

  return (isShort ? lowerFirst : upperFirst)(formatDate(date, format));
}

function formatDate(date: Date, format: string) {
  const day = date.getDate();
  const monthIndex = date.getMonth();

  return format
    .replace('LLLL', getTranslation(MONTHS_FULL[monthIndex]))
    .replace('MMMM', getTranslation(`Month.Gen${MONTHS_FULL[monthIndex]}`))
    .replace('MMM', getTranslation(`Month.Short${MONTHS_FULL[monthIndex]}`))
    .replace('MM', String(monthIndex + 1).padStart(2, '0'))
    .replace('dd', String(day).padStart(2, '0'))
    .replace('d', String(day))
    .replace('yyyy', String(date.getFullYear()));
}

export function formatMediaDateTime(datetime: number | Date) {
  const date = typeof datetime === 'number' ? new Date(datetime) : datetime;

  return `${formatHumanDate(date, true)}, ${formatTime(date)}`;
}

export function formatMediaDuration(duration: number) {
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = Math.floor(duration % 3600 % 60);

  let string = '';
  if (hours > 0) {
    string += `${String(hours).padStart(2, '0')}:`;
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

export function formatDateToString(date: Date) {
  return date.toLocaleString(
    'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
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
  return timestamp + MILISECONDS_IN_DAY / 1000;
}

function lowerFirst(str: string) {
  return `${str[0].toLowerCase()}${str.slice(1)}`;
}

function upperFirst(str: string) {
  return `${str[0].toUpperCase()}${str.slice(1)}`;
}
