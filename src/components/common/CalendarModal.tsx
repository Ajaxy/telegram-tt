import React, {
  FC, memo, useState, useEffect, useMemo, useCallback,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import { formatTime, formatDateToString } from '../../util/dateFormat';
import useLang, { LangFn } from '../../hooks/useLang';
import usePrevious from '../../hooks/usePrevious';
import useFlag from '../../hooks/useFlag';

import Modal from '../ui/Modal';
import Button from '../ui/Button';

import './CalendarModal.scss';

const MAX_SAFE_DATE = 2147483647 * 1000; // API has int for dates

export type OwnProps = {
  selectedAt?: number;
  maxAt?: number;
  isFutureMode?: boolean;
  isPastMode?: boolean;
  isOpen: boolean;
  withTimePicker?: boolean;
  submitButtonLabel?: string;
  secondButtonLabel?: string;
  onClose: () => void;
  onSubmit: (date: Date) => void;
  onSecondButtonClick?: NoneToVoidFunction;
};

const WEEKDAY_LETTERS = [
  'lng_weekday1',
  'lng_weekday2',
  'lng_weekday3',
  'lng_weekday4',
  'lng_weekday5',
  'lng_weekday6',
  'lng_weekday7',
];

const CalendarModal: FC<OwnProps> = ({
  selectedAt,
  maxAt,
  isFutureMode,
  isPastMode,
  isOpen,
  withTimePicker,
  submitButtonLabel,
  secondButtonLabel,
  onClose,
  onSubmit,
  onSecondButtonClick,
}) => {
  const lang = useLang();
  const now = new Date();
  const defaultSelectedDate = useMemo(() => (selectedAt ? new Date(selectedAt) : new Date()), [selectedAt]);
  const maxDate = new Date(Math.min(maxAt || MAX_SAFE_DATE, MAX_SAFE_DATE));
  const prevIsOpen = usePrevious(isOpen);
  const [isTimeInputFocused, markTimeInputAsFocused, unmarkTimeInputAsFocused] = useFlag(false);

  const [selectedDate, setSelectedDate] = useState<Date>(defaultSelectedDate);
  const [currentMonthAndYear, setCurrentMonthAndYear] = useState<Date>(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );
  const [selectedHours, setSelectedHours] = useState<string>(
    formatInputTime(defaultSelectedDate.getHours()),
  );
  const [selectedMinutes, setSelectedMinutes] = useState<string>(
    formatInputTime(defaultSelectedDate.getMinutes()),
  );

  const selectedDay = formatDay(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  const currentYear = currentMonthAndYear.getFullYear();
  const currentMonth = currentMonthAndYear.getMonth();

  useEffect(() => {
    if (!prevIsOpen && isOpen) {
      setSelectedDate(defaultSelectedDate);
      setCurrentMonthAndYear(new Date(defaultSelectedDate.getFullYear(), defaultSelectedDate.getMonth(), 1));
      if (withTimePicker) {
        setSelectedHours(defaultSelectedDate.getHours().toString());
        setSelectedMinutes(defaultSelectedDate.getMinutes().toString());
      }
    }
  }, [defaultSelectedDate, isOpen, prevIsOpen, withTimePicker]);

  useEffect(() => {
    if (isFutureMode && !isTimeInputFocused && selectedDate.getTime() < defaultSelectedDate.getTime()) {
      setSelectedDate(defaultSelectedDate);
      setSelectedHours(formatInputTime(defaultSelectedDate.getHours()));
      setSelectedMinutes(formatInputTime(defaultSelectedDate.getMinutes()));
    }
  }, [defaultSelectedDate, isTimeInputFocused, isFutureMode, selectedDate]);

  const shouldDisableNextMonth = (isPastMode && currentYear >= now.getFullYear() && currentMonth >= now.getMonth())
    || (maxDate && currentYear >= maxDate.getFullYear() && currentMonth >= maxDate.getMonth());
  const shouldDisablePrevMonth = isFutureMode && currentYear <= now.getFullYear() && currentMonth <= now.getMonth();

  const { prevMonthGrid, currentMonthGrid, nextMonthGrid } = useMemo(() => (
    buildCalendarGrid(currentYear, currentMonth)
  ), [currentMonth, currentYear]);

  function handlePrevMonth() {
    setCurrentMonthAndYear((d) => {
      const dateCopy = new Date(d);
      dateCopy.setMonth(dateCopy.getMonth() - 1);

      return dateCopy;
    });
  }

  function handleNextMonth() {
    setCurrentMonthAndYear((d) => {
      const dateCopy = new Date(d);
      dateCopy.setMonth(dateCopy.getMonth() + 1);

      return dateCopy;
    });
  }

  function handleDateSelect(date: number) {
    setSelectedDate((d) => {
      const dateCopy = new Date(d);
      dateCopy.setDate(date);
      dateCopy.setMonth(currentMonth);
      dateCopy.setFullYear(currentYear);

      return dateCopy;
    });
  }

  function handleSubmit() {
    onSubmit(selectedDate);
  }

  const handleChangeHours = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d]+/g, '');
    if (!value.length) {
      setSelectedHours('');
      e.target.value = '';
      return;
    }

    const hours = Math.max(0, Math.min(Number(value), 23));

    const date = new Date(selectedDate.getTime());
    date.setHours(hours);
    setSelectedDate(date);

    const hoursStr = formatInputTime(hours);
    setSelectedHours(hoursStr);
    e.target.value = hoursStr;
  }, [selectedDate]);

  const handleChangeMinutes = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d]+/g, '');
    if (!value.length) {
      setSelectedMinutes('');
      e.target.value = '';
      return;
    }

    const minutes = Math.max(0, Math.min(Number(value), 59));

    const date = new Date(selectedDate.getTime());
    date.setMinutes(minutes);
    setSelectedDate(date);

    const minutesStr = formatInputTime(minutes);
    setSelectedMinutes(minutesStr);
    e.target.value = minutesStr;
  }, [selectedDate]);

  function renderTimePicker() {
    return (
      <div className="timepicker">
        <input
          type="text"
          className="form-control"
          inputMode="decimal"
          value={selectedHours}
          onChange={handleChangeHours}
          onFocus={markTimeInputAsFocused}
          onBlur={unmarkTimeInputAsFocused}
        />
        :
        <input
          type="text"
          className="form-control"
          inputMode="decimal"
          value={selectedMinutes}
          onChange={handleChangeMinutes}
          onFocus={markTimeInputAsFocused}
          onBlur={unmarkTimeInputAsFocused}
        />
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="CalendarModal"
    >
      <div className="container">
        <div className="month-selector">
          <Button
            round
            size="smaller"
            color="translucent"
            onClick={onClose}
          >
            <i className="icon-close" />
          </Button>

          <h4>
            {lang(`lng_month${currentMonth + 1}`)}
            {' '}
            {currentYear}
          </h4>

          <Button
            round
            size="smaller"
            color="translucent"
            disabled={shouldDisablePrevMonth}
            onClick={!shouldDisablePrevMonth ? handlePrevMonth : undefined}
          >
            <i className="icon-previous" />
          </Button>

          <Button
            round
            size="smaller"
            color="translucent"
            disabled={shouldDisableNextMonth}
            onClick={!shouldDisableNextMonth ? handleNextMonth : undefined}
          >
            <i className="icon-next" />
          </Button>
        </div>
      </div>

      <div className="calendar-wrapper">
        <div className="calendar-grid">
          {WEEKDAY_LETTERS.map((day) => (
            <div className="day-button faded weekday">
              <span>{lang(day)}</span>
            </div>
          ))}
          {prevMonthGrid.map((gridDate) => (
            <div className="day-button disabled"><span>{gridDate}</span></div>
          ))}
          {currentMonthGrid.map((gridDate) => (
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleDateSelect(gridDate)}
              className={buildClassName(
                'day-button',
                isDisabledDay(
                  currentYear, currentMonth, gridDate, isFutureMode ? now : undefined, isPastMode ? now : maxDate,
                )
                  ? 'disabled'
                  : `${gridDate ? 'clickable' : ''}`,
                selectedDay === formatDay(currentYear, currentMonth, gridDate) && 'selected',
              )}
            >
              {!!gridDate && (
                <span>{gridDate}</span>
              )}
            </div>
          ))}
          {nextMonthGrid.map((gridDate) => (
            <div className="day-button disabled"><span>{gridDate}</span></div>
          ))}
        </div>
      </div>

      {withTimePicker && renderTimePicker()}

      <div className="footer">
        <Button onClick={handleSubmit}>
          {submitButtonLabel || formatSubmitLabel(lang, selectedDate)}
        </Button>
        {secondButtonLabel && (
          <Button onClick={onSecondButtonClick} isText>
            {secondButtonLabel}
          </Button>
        )}
      </div>
    </Modal>
  );
};

function buildCalendarGrid(year: number, month: number) {
  const prevMonthGrid: number[] = [];
  const currentMonthGrid: number[] = [];
  const nextMonthGrid: number[] = [];

  const date = new Date();
  date.setDate(1);
  date.setMonth(month);
  date.setFullYear(year);
  const firstDay = date.getDay();
  const totalDaysInPrevMonth = new Date(year, month, 0).getDate();

  for (let i = 1; i < firstDay; i++) {
    prevMonthGrid.push(totalDaysInPrevMonth - firstDay + i + 1);
  }

  while (date.getMonth() === month) {
    const gridDate = date.getDate();
    currentMonthGrid.push(gridDate);
    date.setDate(gridDate + 1);
  }

  const lastRowDaysCount = (currentMonthGrid.length + prevMonthGrid.length) % 7;
  if (lastRowDaysCount > 0) {
    for (let i = 1; i <= 7 - lastRowDaysCount; i++) {
      nextMonthGrid.push(i);
    }
  }

  return { prevMonthGrid, currentMonthGrid, nextMonthGrid };
}

function isDisabledDay(year: number, month: number, day: number, minDate?: Date, maxDate?: Date) {
  const selectedDay = new Date(year, month, day, 0, 0, 0, 0);
  const fixedMinDate = minDate && new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate(), 0, 0, 0, 0);
  const fixedMaxDate = maxDate && new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate(), 0, 0, 0, 0);

  if (fixedMaxDate && selectedDay > fixedMaxDate) {
    return true;
  } else if (fixedMinDate && selectedDay < fixedMinDate) {
    return true;
  }

  return false;
}

function formatInputTime(value: string | number) {
  return String(value).padStart(2, '0');
}

function formatDay(year: number, month: number, day: number) {
  return `${year}-${month + 1}-${day}`;
}

function formatSubmitLabel(lang: LangFn, date: Date) {
  const day = formatDateToString(date, lang.code);
  const today = formatDateToString(new Date(), lang.code);

  if (day === today) {
    return lang('Conversation.ScheduleMessage.SendToday', formatTime(lang, date));
  }

  return lang('Conversation.ScheduleMessage.SendOn', [day, formatTime(lang, date)]);
}

export default memo(CalendarModal);
