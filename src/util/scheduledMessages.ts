import type { LangFn } from './localization';

import { DAY, MINUTE, MONTH, WEEK } from './dates/units';

export type RepeatedMessageMode = 'never' | 'everyminute' | 'every5minutes' | 'daily' | 'weekly'
  | 'biweekly' | 'monthly' | 'every3months' | 'every6months' | 'yearly';

type ActualRepeatedMessageMode = Exclude<RepeatedMessageMode, 'never'>;

const MODE_TO_SECONDS: Record<ActualRepeatedMessageMode, number> = {
  everyminute: MINUTE,
  every5minutes: 5 * MINUTE,
  daily: DAY,
  weekly: WEEK,
  biweekly: 2 * WEEK,
  monthly: MONTH,
  every3months: 91 * DAY,
  every6months: 182 * DAY,
  yearly: 365 * DAY,
};

export const ALL_REPEAT_MODES: RepeatedMessageMode[] = [
  'never',
  ...Object.keys(MODE_TO_SECONDS) as ActualRepeatedMessageMode[],
];

export const TEST_SERVER_ONLY_MODES = new Set<RepeatedMessageMode>([
  'everyminute',
  'every5minutes',
]);

export function getRepeatPeriodSeconds(mode?: RepeatedMessageMode) {
  if (!mode || mode === 'never') return undefined;

  return MODE_TO_SECONDS[mode];
}

export function getRepeatModeFromSeconds(seconds?: number) {
  if (!seconds) return undefined;

  return (Object.keys(MODE_TO_SECONDS) as ActualRepeatedMessageMode[])
    .find((mode) => MODE_TO_SECONDS[mode] === seconds);
}

export function getRepeatPeriodText(seconds: number | undefined, lang: LangFn) {
  if (!seconds) return undefined;

  const mode = getRepeatModeFromSeconds(seconds);
  if (!mode) return undefined;

  switch (mode) {
    case 'everyminute':
      return lang('MessageRepeatPeriodEveryMinutes', { count: 1 }, { pluralValue: 1 });
    case 'every5minutes':
      return lang('MessageRepeatPeriodEveryMinutes', { count: 5 }, { pluralValue: 5 });
    case 'daily':
      return lang('MessageRepeatPeriodDaily');
    case 'weekly':
      return lang('MessageRepeatPeriodWeekly');
    case 'biweekly':
      return lang('MessageRepeatPeriodBiweekly');
    case 'monthly':
      return lang('MessageRepeatPeriodMonthly');
    case 'every3months':
      return lang('MessageRepeatPeriodEveryMonths', { count: 3 }, { pluralValue: 3 });
    case 'every6months':
      return lang('MessageRepeatPeriodEveryMonths', { count: 6 }, { pluralValue: 6 });
    case 'yearly':
      return lang('MessageRepeatPeriodYearly');
    default:
      return undefined;
  }
}

export function getScheduleRepeatModeText(mode: RepeatedMessageMode, lang: LangFn) {
  switch (mode) {
    case 'never':
      return lang('ScheduleRepeatNever');
    case 'everyminute':
      return lang('ScheduleRepeatEveryMinutes', { count: 1 }, { pluralValue: 1 });
    case 'every5minutes':
      return lang('ScheduleRepeatEveryMinutes', { count: 5 }, { pluralValue: 5 });
    case 'daily':
      return lang('ScheduleRepeatDaily');
    case 'weekly':
      return lang('ScheduleRepeatWeekly');
    case 'biweekly':
      return lang('ScheduleRepeatBiweekly');
    case 'monthly':
      return lang('ScheduleRepeatMonthly');
    case 'every3months':
      return lang('ScheduleRepeatEveryMonths', { count: 3 }, { pluralValue: 3 });
    case 'every6months':
      return lang('ScheduleRepeatEveryMonths', { count: 6 }, { pluralValue: 6 });
    case 'yearly':
      return lang('ScheduleRepeatYearly');
    default:
      return lang('ScheduleRepeatNever');
  }
}
