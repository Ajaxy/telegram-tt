import { memo, useMemo } from '../../../lib/teact/teact';

import type { LangFn } from '../../../util/localization';

import { parseCalendarDate } from '../../../util/dates/dateMath';
import { formatDateTime, secondsToDate } from '../../../util/localization/dateFormat';
import { getServerTime } from '../../../util/serverTime';

import useLang from '../../../hooks/useLang';

import Icon from '../../common/icons/Icon';

import './DateSuggest.scss';

const SUGGESTION_COUNT = 8;

export type OwnProps = {
  searchDate: string;
  onSelect: (value: Date) => void;
};

const DateSuggest = ({
  searchDate, onSelect,
}: OwnProps) => {
  const lang = useLang();
  const suggestions = useMemo(() => getSuggestionsFromDate(lang, searchDate), [lang, searchDate]);
  return (
    <section className="DateSuggest custom-scroll custom-scroll-x">
      {suggestions.map(({ date, text }) => {
        return (
          <div
            onClick={() => onSelect(date)}
            className="date-item"
            key={text}
          >
            <Icon name="calendar" />
            <span>{text}</span>
          </div>
        );
      })}
    </section>
  );
};

function getSuggestionsFromDate(lang: LangFn, searchDate: string) {
  const hasYear = searchDate.match(/^\d{2,4}-\d{2}-\d{2}$/g);
  if (hasYear) {
    const date = parseCalendarDate(searchDate);
    return [{ date, text: formatDateTime(lang, date, { date: 'short' }) }];
  }

  const suggestion = [];
  const currentDate = secondsToDate(getServerTime());
  const currentYear = currentDate.getFullYear();
  const latestYear = currentDate.getTime() > parseCalendarDate(`${currentYear}-${searchDate}`).getTime()
    ? currentYear
    : currentYear - 1;

  for (let i = 0; i < SUGGESTION_COUNT; i++) {
    const date = parseCalendarDate(`${latestYear - i}-${searchDate}`);
    suggestion.push({ date, text: formatDateTime(lang, date, { date: 'short' }) });
  }

  return suggestion;
}

export default memo(DateSuggest);
