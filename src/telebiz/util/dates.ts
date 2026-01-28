/**
 * Formats a Date object to an ISO string with timezone offset (e.g., 2026-01-08T15:00:00+03:00)
 * This preserves the user's intended local time when sending to external systems.
 */
export function toLocalISOString(date: Date): string {
  const tzOffset = -date.getTimezoneOffset();
  const sign = tzOffset >= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(tzOffset) % 60).padStart(2, '0');

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${hours}:${minutes}`;
}

export function formatDateTime(date: string) {
  const dateToParse = new Date(date);
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  };

  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };

  const datePart = dateToParse.toLocaleDateString('en-US', dateOptions);
  const timePart = dateToParse.toLocaleTimeString('en-US', timeOptions);

  return `${datePart} • ${timePart}`;
}

export function formatTimeAndOptionalDate(dateInput: string) {
  const date = new Date(dateInput);
  const now = new Date();

  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  if (isToday) {
    return time;
  }

  const datePart = date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });

  return `${datePart}, ${time}`;
}

export function formatDate(date: string) {
  const dateToParse = new Date(date);
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  };
  return dateToParse.toLocaleDateString('en-US', dateOptions);
}

export function formatDateTimeShort(date: string) {
  const dateToParse = new Date(date);
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: 'short',
  };
  return dateToParse.toLocaleDateString('en-US', dateOptions);
}

export function splitByDate<T>(
  { items, dateField, splitDate }: { items: T[]; dateField: keyof T; splitDate?: string },
): [T[], T[]] {
  const before: T[] = [];
  const after: T[] = [];
  const splitBy = splitDate ? new Date(splitDate).getTime() : Date.now();

  const toTime = (item: T) => new Date(item[dateField] as unknown as string).getTime();

  if (!items || items.length === 0) return [[], []];

  items.forEach((item) => {
    (toTime(item) >= splitBy ? after : before).push(item);
  });

  before.sort((a, b) => toTime(b) - toTime(a));
  after.sort((a, b) => toTime(b) - toTime(a));

  return [before, after];
}

export function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

export function addTime(date: string, time: number, type: 'weeks' | 'days' | 'hours' | 'minutes' | 'seconds'): string {
  const baseDate = new Date(date);
  switch (type) {
    case 'weeks':
      return new Date(baseDate.getTime() + time * 7 * 24 * 60 * 60 * 1000).toISOString();
    case 'days':
      return new Date(baseDate.getTime() + time * 24 * 60 * 60 * 1000).toISOString();
    case 'hours':
      return new Date(baseDate.getTime() + time * 60 * 60 * 1000).toISOString();
    case 'minutes':
      return new Date(baseDate.getTime() + time * 60 * 1000).toISOString();
    case 'seconds':
      return new Date(baseDate.getTime() + time * 1000).toISOString();
    default:
      return baseDate.toISOString();
  }
}
