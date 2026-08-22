import type { LangFn } from '../../../util/localization';

import { formatCountdown } from '../../../util/dates/oldDateFormat';
import {
  DAY, HOUR, MINUTE, MONTH, WEEK, YEAR,
} from '../../../util/dates/units';

type BadgeUnitKey = 'AutoDeleteBadgeSeconds' | 'AutoDeleteBadgeMinutes' | 'AutoDeleteBadgeHours'
  | 'AutoDeleteBadgeDays' | 'AutoDeleteBadgeWeeks' | 'AutoDeleteBadgeMonths' | 'AutoDeleteBadgeYears';

const BADGE_MONTH_THRESHOLD = 31 * DAY;
const BADGE_YEAR_THRESHOLD = 364 * DAY;

export const DEFAULT_AUTO_DELETE_PERIODS = [0, DAY, WEEK, MONTH];
export const CUSTOM_AUTO_DELETE_PERIODS = [
  0,
  DAY,
  2 * DAY,
  3 * DAY,
  4 * DAY,
  5 * DAY,
  6 * DAY,
  WEEK,
  2 * WEEK,
  3 * WEEK,
  MONTH,
  2 * MONTH,
  3 * MONTH,
  4 * MONTH,
  5 * MONTH,
  6 * MONTH,
  YEAR,
];

// A non-standard current period is inserted into the list, so it can be displayed as selected
export function buildAutoDeletePeriodOptions(
  lang: LangFn,
  predefinedPeriods: number[],
  currentPeriod: number | undefined,
  disabledLabel: string,
) {
  const periods = [...predefinedPeriods];

  if (currentPeriod !== undefined && !periods.includes(currentPeriod)) {
    const insertionIndex = periods.findIndex((period) => period > currentPeriod);
    if (insertionIndex === -1) {
      periods.push(currentPeriod);
    } else {
      periods.splice(insertionIndex, 0, currentPeriod);
    }
  }

  return periods.map((period) => ({
    label: period === 0 ? disabledLabel : formatCountdown(lang, period),
    value: String(period),
  }));
}

// Compact single-digit label like `1d` or `4m`; `undefined` when the period does not fit into a badge
export function formatAutoDeleteBadgePeriod(lang: LangFn, period: number) {
  if (period < MINUTE) {
    return formatBadgeUnit(lang, period, 'AutoDeleteBadgeSeconds');
  }

  if (period < HOUR) {
    return formatBadgeUnit(lang, Math.floor(period / MINUTE), 'AutoDeleteBadgeMinutes');
  }

  if (period < DAY) {
    return formatBadgeUnit(lang, Math.floor(period / HOUR), 'AutoDeleteBadgeHours');
  }

  if (period < WEEK) {
    return formatBadgeUnit(lang, Math.floor(period / DAY), 'AutoDeleteBadgeDays');
  }

  if (period < BADGE_MONTH_THRESHOLD) {
    return formatBadgeUnit(lang, Math.floor(period / WEEK), 'AutoDeleteBadgeWeeks');
  }

  if (period < BADGE_YEAR_THRESHOLD) {
    return formatBadgeUnit(lang, Math.floor(period / MONTH), 'AutoDeleteBadgeMonths');
  }

  return formatBadgeUnit(lang, Math.floor(period / BADGE_YEAR_THRESHOLD), 'AutoDeleteBadgeYears');
}

function formatBadgeUnit(lang: LangFn, value: number, unitKey: BadgeUnitKey) {
  const valueText = String(value);
  return valueText.length < 2 ? `${valueText}${lang(unitKey)}` : undefined;
}
