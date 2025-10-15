import type { FC } from '../../lib/teact/teact';
import type React from '../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';

import type { OldLangFn } from '../../hooks/useOldLang';

import { MAX_INT_32 } from '../../config';
import buildClassName from '../../util/buildClassName';
import { formatDateToString, formatTime, getDayStart } from '../../util/dates/dateFormat';

import useFlag from '../../hooks/useFlag';
import useOldLang from '../../hooks/useOldLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';

import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Icon from './icons/Icon';

import './CalendarModal.scss';

const MAX_SAFE_DATE = MAX_INT_32 * 1000;
const MIN_SAFE_DATE = 0;

export type OwnProps = {
  selectedAt?: number;
  minAt?: number;
  maxAt?: number;
  isFutureMode?: boolean;
  isPastMode?: boolean;
  isOpen: boolean;
  withTimePicker?: boolean;
  submitButtonLabel?: string;
  secondButtonLabel?: string;
  description?: string;
  onClose: () => void;
  onSubmit: (date: Date) => void;
  onDateChange?: (date: Date) => void;
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
  minAt,
  maxAt,
  isFutureMode,
  isPastMode,
  isOpen,
  withTimePicker,
  submitButtonLabel,
  secondButtonLabel,
  description,
  onClose,
  onSubmit,
  onDateChange,
  onSecondButtonClick,
}) => {
  const lang = useOldLang();
  const now = new Date();

  const minDate = useMemo(() => {
    if (isFutureMode && !minAt) return new Date();
    return new Date(Math.max(minAt || MIN_SAFE_DATE, MIN_SAFE_DATE));
  }, [isFutureMode, minAt]);
  const maxDate = useMemo(() => {
    if (isPastMode && !maxAt) return new Date();
    return new Date(Math.min(maxAt || MAX_SAFE_DATE, MAX_SAFE_DATE));
  }, [isPastMode, maxAt]);

  const passedSelectedDate = useMemo(() => (selectedAt ? new Date(selectedAt) : new Date()), [selectedAt]);
  const prevIsOpen = usePreviousDeprecated(isOpen);
  const [isTimeInputFocused, markTimeInputAsFocused] = useFlag(false);

  const [selectedDate, setSelectedDate] = useState<Date>(passedSelectedDate);
  const [currentMonthAndYear, setCurrentMonthAndYear] = useState<Date>(() => (
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  ));
  const [selectedHours, setSelectedHours] = useState<string>(() => (
    formatInputTime(passedSelectedDate.getHours())
  ));
  const [selectedMinutes, setSelectedMinutes] = useState<string>(() => (
    formatInputTime(passedSelectedDate.getMinutes())
  ));

  const selectedDay = formatDay(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  const currentYear = currentMonthAndYear.getFullYear();
  const currentMonth = currentMonthAndYear.getMonth();

  const isDisabled = (isFutureMode && selectedDate.getTime() < minDate.getTime())
    || (isPastMode && selectedDate.getTime() > maxDate.getTime());

  useEffect(() => {
    if (!prevIsOpen && isOpen) {
      setSelectedDate(passedSelectedDate);
      setCurrentMonthAndYear(new Date(passedSelectedDate.getFullYear(), passedSelectedDate.getMonth(), 1));
      if (withTimePicker) {
        setSelectedHours(formatInputTime(passedSelectedDate.getHours()));
        setSelectedMinutes(formatInputTime(passedSelectedDate.getMinutes()));
      }
    }
  }, [passedSelectedDate, isOpen, prevIsOpen, withTimePicker]);

  useEffect(() => {
    if (isFutureMode && !isTimeInputFocused && selectedDate.getTime() < minDate.getTime()) {
      setSelectedDate(minDate);
      setSelectedHours(formatInputTime(minDate.getHours()));
      setSelectedMinutes(formatInputTime(minDate.getMinutes()));
    }
  }, [isFutureMode, isTimeInputFocused, minDate, selectedDate]);

  useEffect(() => {
    if (isPastMode && !isTimeInputFocused && selectedDate.getTime() > maxDate.getTime()) {
      setSelectedDate(maxDate);
      setSelectedHours(formatInputTime(maxDate.getHours()));
      setSelectedMinutes(formatInputTime(maxDate.getMinutes()));
    }
  }, [isFutureMode, isPastMode, isTimeInputFocused, maxDate, minDate, selectedDate]);

  useEffect(() => {
    if (selectedAt) {
      const newSelectedDate = new Date(selectedAt);
      setSelectedDate(newSelectedDate);
      setSelectedHours(formatInputTime(newSelectedDate.getHours()));
      setSelectedMinutes(formatInputTime(newSelectedDate.getMinutes()));
    }
  }, [selectedAt]);

  const shouldDisableNextMonth = (isPastMode && currentYear >= now.getFullYear() && currentMonth >= now.getMonth())
    || (maxDate && currentYear >= maxDate.getFullYear() && currentMonth >= maxDate.getMonth());
  const shouldDisablePrevMonth = isFutureMode && currentYear <= now.getFullYear() && currentMonth <= now.getMonth();

  const { prevMonthGrid, currentMonthGrid, nextMonthGrid } = useMemo(() => (
    buildCalendarGrid(currentYear, currentMonth)
  ), [currentMonth, currentYear]);

  const submitLabel = useMemo(() => {
    return submitButtonLabel || formatSubmitLabel(lang, selectedDate);
  }, [lang, selectedDate, submitButtonLabel]);

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

      onDateChange?.(dateCopy);
      return dateCopy;
    });
  }

  const handleSubmit = useCallback(() => {
    if (isFutureMode && selectedDate < minDate) {
      onSubmit(minDate);
    } else if (isPastMode && selectedDate > maxDate) {
      onSubmit(maxDate);
    } else {
      onSubmit(selectedDate);
    }
  }, [isFutureMode, isPastMode, minDate, maxDate, onSubmit, selectedDate]);

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
    onDateChange?.(date);

    const hoursStr = formatInputTime(hours);
    setSelectedHours(hoursStr);
    e.target.value = hoursStr;
  }, [selectedDate, onDateChange]);

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
    onDateChange?.(date);

    const minutesStr = formatInputTime(minutes);
    setSelectedMinutes(minutesStr);
    e.target.value = minutesStr;
  }, [selectedDate, onDateChange]);

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
        />
        :
        <input
          type="text"
          className="form-control"
          inputMode="decimal"
          value={selectedMinutes}
          onChange={handleChangeMinutes}
          onFocus={markTimeInputAsFocused}
        />
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="CalendarModal"
      onEnter={handleSubmit}
    >
      <div className="container">
        <div className="month-selector">
          <Button
            round
            size="smaller"
            color="translucent"
            onClick={onClose}
          >
            <Icon name="close" />
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
            <Icon name="previous" />
          </Button>

          <Button
            round
            size="smaller"
            color="translucent"
            disabled={shouldDisableNextMonth}
            onClick={!shouldDisableNextMonth ? handleNextMonth : undefined}
          >
            <Icon name="next" />
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
                'div-button',
                isDisabledDay(
                  currentYear, currentMonth, gridDate, minDate, maxDate,
                )
                  ? 'disabled'
                  : gridDate ? 'clickable' : '',
                selectedDay === formatDay(currentYear, currentMonth, gridDate) && 'selected',
              )}
            >
              {Boolean(gridDate) && (
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
        {description && (
          <div className="description">
            {description}
          </div>
        )}
        <div className="footer">
          <Button
            onClick={handleSubmit}
            disabled={isDisabled}
          >
            {submitLabel}
          </Button>
          {secondButtonLabel && (
            <Button onClick={onSecondButtonClick} isText>
              {secondButtonLabel}
            </Button>
          )}
        </div>
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
  const firstDay = date.getDay() || 7;
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
  const selectedDay = new Date(year, month, day);
  const fixedMinDate = minDate && getDayStart(minDate);
  const fixedMaxDate = maxDate && getDayStart(maxDate);

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

function formatSubmitLabel(lang: OldLangFn, date: Date) {
  const day = formatDateToString(date, lang.code);
  const today = formatDateToString(new Date(), lang.code);

  if (day === today) {
    return lang('Conversation.ScheduleMessage.SendToday', formatTime(lang, date));
  }

  return lang('Conversation.ScheduleMessage.SendOn', [day, formatTime(lang, date)]);
}

export default memo(CalendarModal);
