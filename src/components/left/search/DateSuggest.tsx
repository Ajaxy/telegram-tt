import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../lib/teact/teact';

import { formatDateToString } from '../../../util/dates/dateFormat';

import Icon from '../../common/icons/Icon';

import './DateSuggest.scss';

const SUGGESTION_COUNT = 8;

export type OwnProps = {
  searchDate: string;
  onSelect: (value: Date) => void;
};

const DateSuggest: FC<OwnProps> = ({
  searchDate, onSelect,
}) => {
  const suggestions = useMemo(() => getSuggestionsFromDate(searchDate), [searchDate]);
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

function getSuggestionsFromDate(searchDate: string) {
  const hasYear = searchDate.match(/^\d{2,4}-\d{2}-\d{2}$/g);
  if (hasYear) {
    const date = new Date(searchDate);
    return [{ date, text: formatDateToString(date) }];
  }

  const suggestion = [];
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const latestYear = currentDate.getTime() > (new Date(`${currentYear}-${searchDate}`)).getTime()
    ? currentYear
    : currentYear - 1;

  for (let i = 0; i < SUGGESTION_COUNT; i++) {
    const date = new Date(`${latestYear - i}-${searchDate}`);
    suggestion.push({ date, text: formatDateToString(date) });
  }

  return suggestion;
}

export default memo(DateSuggest);
