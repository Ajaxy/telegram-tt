import type { ApiFormattedText, ApiMessageEntityFormattedDate } from '../../api/types';
import type { LangFn } from '../localization';
import { ApiMessageEntityTypes } from '../../api/types';

import { formatDateTime, secondsToDate } from '../localization/dateFormat';

export type FormattedDateEntityOptions = Pick<
  ApiMessageEntityFormattedDate,
  'relative' | 'shortTime' | 'longTime' | 'shortDate' | 'longDate' | 'dayOfWeek'
>;

export function hasFormattedDateFormat(options: FormattedDateEntityOptions) {
  return Object.values(options).some(Boolean);
}

export function getFormattedDateFormatString(options: FormattedDateEntityOptions) {
  return [
    options.relative && 'r',
    options.dayOfWeek && 'w',
    options.shortDate && 'd',
    options.longDate && 'D',
    options.shortTime && 't',
    options.longTime && 'T',
  ].filter(Boolean).join('');
}

export function getCanonicalFormattedDate(lang: LangFn, date: number) {
  return formatDateTime(lang, secondsToDate(date), {
    date: 'long',
    includeYear: true,
    includeDay: true,
    time: 'long',
  });
}

export function getDefaultFormattedDateText(lang: LangFn, date: number) {
  return formatDateTime(lang, secondsToDate(date), {
    date: 'long',
    time: 'short',
  });
}

export function formatFormattedDateText(
  lang: LangFn,
  date: number,
  options: FormattedDateEntityOptions,
) {
  if (!hasFormattedDateFormat(options)) {
    return undefined;
  }

  return formatDateTime(lang, secondsToDate(date), {
    relative: options.relative ? 'auto' : undefined,
    time: options.shortTime ? 'short' : options.longTime ? 'long' : undefined,
    date: options.shortDate ? 'short' : options.longDate ? 'long' : undefined,
    weekday: options.dayOfWeek ? 'long' : undefined,
  });
}

export function buildFormattedDateHtml(content: string, entity: ApiMessageEntityFormattedDate) {
  const format = getFormattedDateFormatString(entity);

  return `<a
    class="text-entity-link"
    data-entity-type="${ApiMessageEntityTypes.FormattedDate}"
    data-unix="${entity.date}"
    ${format ? `data-format="${format}"` : ''}
    contenteditable="false"
    draggable="false"
    dir="auto"
  >${content}</a>`;
}

export function buildFormattedDateText(
  text: string,
  date: number,
  options: FormattedDateEntityOptions,
): ApiFormattedText {
  return {
    text,
    entities: [{
      type: ApiMessageEntityTypes.FormattedDate,
      offset: 0,
      length: text.length,
      date,
      ...options,
    }],
  };
}
