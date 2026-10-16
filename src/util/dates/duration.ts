import type { LangFn } from '../localization/types';

import {
  DAY, getDays, HOUR, MINUTE, MONTH, WEEK, YEAR,
} from './units';

const HUNDREDTH_IN_MS = 10;
const TWO_DIGIT_MINUTES = 10;
const MILLISECONDS_IN_SECOND = 1000;
const DAYS_IN_SHORT_YEAR = 360;
const DURATION_PARTS = [
  { multiplier: 1, type: 'Seconds' },
  { multiplier: MINUTE, type: 'Minutes' },
  { multiplier: MINUTE, type: 'Hours' },
  { multiplier: DAY / HOUR, type: 'Days' },
  { multiplier: WEEK / DAY, type: 'Weeks' },
] as const;

// Rounds up so the displayed duration covers all remaining time, including unit overflows
export function formatCountdown(lang: LangFn, secondsLeft: number) {
  const days = getDays(secondsLeft);
  if (secondsLeft < 0) {
    return 0;
  }

  if (days < 1) {
    return formatMediaDuration(secondsLeft);
  }

  if (days < WEEK / DAY) {
    return lang('Days', { count: days }, { pluralValue: days });
  }

  const weeks = Math.ceil(days / (WEEK / DAY));
  if (weeks * WEEK < MONTH) {
    return lang('Weeks', { count: weeks }, { pluralValue: weeks });
  }

  const months = Math.ceil(days / (MONTH / DAY));
  if (months * MONTH < YEAR) {
    return lang('Months', { count: months }, { pluralValue: months });
  }

  const years = Math.ceil(days / (YEAR / DAY));
  return lang('Years', { count: years }, { pluralValue: years });
}

export function formatCountdownDays(lang: LangFn, days: number) {
  if (days < WEEK / DAY) {
    return lang('Days', { count: days }, { pluralValue: days });
  }
  if (days < MONTH / DAY) {
    const count = Math.floor(days / (WEEK / DAY));
    return lang('Weeks', { count }, { pluralValue: count });
  }
  if (days < DAYS_IN_SHORT_YEAR) {
    const count = Math.floor(days / (MONTH / DAY));
    return lang('Months', { count }, { pluralValue: count });
  }
  const count = Math.floor(days / DAYS_IN_SHORT_YEAR);
  return lang('Years', { count }, { pluralValue: count });
}

export function formatCountdownShort(lang: LangFn, msLeft: number): string {
  const seconds = msLeft / MILLISECONDS_IN_SECOND;
  if (seconds < MINUTE) {
    return Math.ceil(seconds).toString();
  }
  if (seconds < HOUR) {
    return Math.ceil(seconds / MINUTE).toString();
  }
  if (seconds < DAY) {
    return lang('MessageTimerShortHours', { count: Math.ceil(seconds / HOUR) });
  }
  return lang('MessageTimerShortDays', { count: Math.ceil(seconds / DAY) });
}

export function formatTimeDuration(lang: LangFn, duration: number, showLast = 2) {
  if (!duration) {
    return undefined;
  }

  const durationRecords: { count: number; type: typeof DURATION_PARTS[number]['type'] }[] = [];
  let divisor = 1;
  DURATION_PARTS.forEach((part, index) => {
    divisor *= part.multiplier;
    if (duration < divisor) {
      return;
    }

    const modulus = DURATION_PARTS[index === DURATION_PARTS.length - 1 ? index : index + 1].multiplier;
    durationRecords.push({ count: Math.floor((duration / divisor) % modulus), type: part.type });
  });

  const parts = durationRecords.slice(-showLast).reverse().filter(({ count }) => count);
  return lang.conjunction(parts.map(({ type, count }) => lang(type, { count }, { pluralValue: count })));
}

export function formatMediaDuration(duration: number, maxValue?: number) {
  const hours = Math.floor(duration / HOUR);
  const minutes = Math.floor((duration % HOUR) / MINUTE);
  const seconds = Math.floor(duration % MINUTE);
  const maxHours = maxValue ? Math.floor(maxValue / HOUR) : 0;
  const maxMinutes = maxValue ? Math.floor((maxValue % HOUR) / MINUTE) : 0;

  if (hours > 0 || maxHours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  const minuteText = maxMinutes >= TWO_DIGIT_MINUTES ? String(minutes).padStart(2, '0') : String(minutes);
  return `${minuteText}:${String(seconds).padStart(2, '0')}`;
}

export function formatClockDuration(duration: number) {
  const hours = Math.floor(duration / HOUR);
  const minutes = Math.floor((duration % HOUR) / MINUTE);
  const seconds = Math.floor(duration % MINUTE);
  const minuteText = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  return `${hours > 0 ? `${hours}:` : ''}${minuteText}:${String(seconds).padStart(2, '0')}`;
}

export function formatShortHoursMinutes(lang: LangFn, durationInSeconds: number) {
  if (durationInSeconds <= 0) {
    return lang('MessageTimerShortMinutes', { count: 0 });
  }

  const hours = Math.floor(durationInSeconds / HOUR);
  const minutes = Math.floor((durationInSeconds % HOUR) / MINUTE);
  if (!hours) {
    return lang('MessageTimerShortMinutes', { count: minutes });
  }

  const hoursText = lang('MessageTimerShortHours', { count: hours });
  return minutes ? lang.conjunction([
    hoursText, lang('MessageTimerShortMinutes', { count: minutes }),
  ]) : hoursText;
}

export function formatVoiceRecordDuration(durationInMs: number) {
  const hundredths = Math.floor((durationInMs % MILLISECONDS_IN_SECOND) / HUNDREDTH_IN_MS);
  const duration = Math.floor(durationInMs / MILLISECONDS_IN_SECOND);
  const seconds = duration % MINUTE;
  const minutes = Math.floor(duration / MINUTE) % MINUTE;
  const hours = Math.floor(duration / HOUR) % MINUTE;
  const minuteText = String(minutes).padStart(hours > 0 ? 2 : 1, '0');
  const hourText = hours > 0 ? `${String(hours).padStart(2, '0')}:` : '';
  return `${hourText}${minuteText}:${String(seconds).padStart(2, '0')},${String(hundredths).padStart(2, '0')}`;
}

export function formatShortDuration(lang: LangFn, duration: number, hoursPriority?: boolean) {
  if (duration < 0) {
    return lang('RightNow');
  }
  if (duration < MINUTE) {
    const count = Math.ceil(duration);
    return lang('Seconds', { count }, { pluralValue: duration });
  }
  if (duration < HOUR) {
    const count = Math.ceil(duration / MINUTE);
    return lang('Minutes', { count }, { pluralValue: count });
  }
  if (duration < DAY || (hoursPriority && duration <= DAY * 2)) {
    const count = Math.ceil(duration / HOUR);
    return lang('Hours', { count }, { pluralValue: count });
  }
  const count = Math.ceil(duration / DAY);
  return lang('Days', { count }, { pluralValue: count });
}
