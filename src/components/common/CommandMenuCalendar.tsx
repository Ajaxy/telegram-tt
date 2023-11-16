/* eslint-disable react/jsx-no-bind */
/* eslint-disable no-async-without-await/no-async-without-await */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Chrono } from 'chrono-node';
import { Command } from 'cmdk';
import {
  useCallback, useEffect, useMemo,
  useState,
} from '../../lib/teact/teact';

import captureKeyboardListeners from '../../util/captureKeyboardListeners';

import '../main/CommandMenu.scss';

export type OwnProps = {
  isOpen: boolean;
  setOpen: (value: boolean) => void;
  onClose: () => void;
  onSubmit: (date: Date) => void;
  onSendWhenOnline?: () => void;
  isReminder?: boolean;
};

const calendarElement = document.getElementById('calendar-root');
const calendarRoot = createRoot(calendarElement!);

const CommandMenuCalendar = ({
  isOpen,
  setOpen,
  onClose,
  onSubmit,
  onSendWhenOnline,
  isReminder,
}: OwnProps) => {
  const chrono = useMemo(() => new Chrono(), []);
  const [inputValue, setInputValue] = useState('');
  const [menuItems, setMenuItems] = useState<Array<{ label: string; value: string; date: Date | undefined }>>();

  const customFilter = (value: string, search: string) => {
    return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
  };

  const placeholderText = isReminder
    ? 'Remind me at... [Try: 8 am, 3 days, aug 7]' : 'Schedule at... [Try: 8 am, 3 days, aug 7]';
  const labelPrefix = isReminder ? 'Remind me at' : 'Schedule at';

  useEffect(() => {
    return isOpen ? captureKeyboardListeners({ onEsc: onClose }) : undefined;
  }, [isOpen, onClose]);

  const in10Minutes = useMemo(() => {
    const parsedResults = chrono.parse('In 10 minutes', new Date());
    if (parsedResults.length > 0) {
      return parsedResults[0].start.date();
    }
    return undefined;
  }, [chrono]);

  const in1Hour = useMemo(() => {
    const parsedResults = chrono.parse('In 1 hour', new Date());
    if (parsedResults.length > 0) {
      return parsedResults[0].start.date();
    }
    return undefined;
  }, [chrono]);

  const tomorrowAt9am = useMemo(() => {
    const parsedResults = chrono.parse('Tomorrow at 9am', new Date());
    if (parsedResults.length > 0) {
      return parsedResults[0].start.date();
    }
    return undefined;
  }, [chrono]);

  const mondayAt9am = useMemo(() => {
    const parsedResults = chrono.parse('Next monday at 9am', new Date());
    if (parsedResults.length > 0) {
      return parsedResults[0].start.date();
    }
    return undefined;
  }, [chrono]);

  useEffect(() => {
    const processInput = async () => {
      try {
        const format12HourTime = (date: Date) => {
          let hours = date.getHours();
          const minutes = date.getMinutes();
          const ampm = hours >= 12 ? 'PM' : 'AM';
          hours %= 12;
          hours = hours || 12; // Если '0', то делаем '12'
          const minutesStr = minutes < 10 ? `0${minutes}` : minutes;

          return `${hours}:${minutesStr} ${ampm}`;
        };

        const isToday = (date: Date) => {
          const today = new Date();
          return date.getDate() === today.getDate()
                 && date.getMonth() === today.getMonth()
                 && date.getFullYear() === today.getFullYear();
        };

        const isTomorrow = (date: Date) => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          return date.getDate() === tomorrow.getDate()
                 && date.getMonth() === tomorrow.getMonth()
                 && date.getFullYear() === tomorrow.getFullYear();
        };

        const formatDate = (date: Date) => {
          if (isToday(date)) {
            return 'Today';
          }

          const months = [
            'January', 'February', 'March', 'April', 'May',
            'June', 'July', 'August', 'September', 'October', 'November', 'December',
          ];
          const day = date.getDate();
          const monthIndex = date.getMonth();
          const year = date.getFullYear();

          return `${day} ${months[monthIndex]} ${year}`;
        };

        const isTimeOnlyInput = (input: string) => {
          return /^\s*\d{1,2}\s*(am|pm)\s*$/i.test(input);
        };
        const now = new Date();
        const parsedResults = chrono.parse(inputValue, new Date());
        if (parsedResults.length > 0) {
          const date = parsedResults[0].start.date();

          if (date < now) {
            if (isTimeOnlyInput(inputValue)) {
              // Установить на завтра, если введено только время и оно уже прошло
              date.setDate(now.getDate() + 1);
              date.setHours(date.getHours(), date.getMinutes(), 0, 0);
            } else {
              // Установить на следующий год, если дата (с годом) в прошлом
              date.setFullYear(now.getFullYear() + 1);
            }
          }

          const timeString = format12HourTime(date);
          const labels = [];
          if (isToday(date)) {
            labels.push(`${labelPrefix} ${timeString} Today`);
          } else if (isTomorrow(date)) {
            labels.push(`${labelPrefix} ${timeString} Tomorrow`);
          } else {
            const dateString = formatDate(date);
            labels.push(`${labelPrefix} ${timeString} on ${dateString}`);
          }

          labels.forEach((label) => {
            if (!menuItems?.some((item) => item.label === label)) {
              const newItem = { label, date, value: inputValue };
              setMenuItems((prevItems) => [...(prevItems ?? []), newItem]);
            }
          });
        }
      } catch (error) {
        //
      }
    };

    const debounceTimer = setTimeout(() => {
      processInput();
    }, 500);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [inputValue, chrono, menuItems, labelPrefix]);

  const onValueChange = useCallback((value: string) => {
    setInputValue(value);
    setMenuItems([]);
  }, []);

  const handleSubmission = useCallback((date: Date) => {
    onSubmit(date); // Передаем date напрямую
    onClose(); // Вызов для закрытия меню
  }, [onSubmit, onClose]);

  const handleIn10Minutes = useCallback(() => {
    if (in10Minutes) {
      handleSubmission(in10Minutes);
    } else {
      // Обработка ошибки или альтернативное действие
    }
  }, [in10Minutes, handleSubmission]);

  const handleIn1Hour = useCallback(() => {
    if (in1Hour) {
      handleSubmission(in1Hour);
    } else {
      // Обработка ошибки или альтернативное действие
    }
  }, [in1Hour, handleSubmission]);

  const handleTomorrowAt9amSelect = useCallback(() => {
    if (tomorrowAt9am) {
      handleSubmission(tomorrowAt9am);
    } else {
      // Обработка ошибки или альтернативное действие
    }
  }, [tomorrowAt9am, handleSubmission]);

  const handleMondayAt9amSelect = useCallback(() => {
    if (mondayAt9am) {
      handleSubmission(mondayAt9am);
    } else {
      // Обработка ошибки или альтернативное действие
    }
  }, [mondayAt9am, handleSubmission]);

  const CommandMenuInner = (
    <Command.Dialog
      label="Calendar Command Menu"
      open={isOpen}
      onOpenChange={setOpen}
      shouldFilter
      filter={customFilter}
      loop
    >
      <Command.Input placeholder={placeholderText} autoFocus onValueChange={onValueChange} />
      <Command.List>
        <Command.Empty>Can not parse data</Command.Empty>
        {menuItems?.map((item) => (
          <Command.Item
            key={`${inputValue} ${item.label}`}
            value={`${inputValue} ${item.label}`}
            onSelect={() => item.date && handleSubmission(item.date)}
          >
            {item.label}
          </Command.Item>
        ))}
        <Command.Item onSelect={handleIn10Minutes}>
          In 10 minutes
        </Command.Item>
        <Command.Item onSelect={handleIn1Hour}>
          In 1 hour
        </Command.Item>
        <Command.Item onSelect={handleTomorrowAt9amSelect}>
          Tomorrow at 9 AM
        </Command.Item>
        <Command.Item onSelect={handleMondayAt9amSelect}>
          On Monday at 9 AM
        </Command.Item>
        {onSendWhenOnline && (
          <Command.Item onSelect={onSendWhenOnline}>
            Send when online
          </Command.Item>
        )}
      </Command.List>
    </Command.Dialog>
  );

  calendarRoot.render(CommandMenuInner);
  return <div />;
};

export default CommandMenuCalendar;
