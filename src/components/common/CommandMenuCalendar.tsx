/* eslint-disable no-null/no-null */
/* eslint-disable react/no-array-index-key */
/* eslint-disable react/jsx-no-bind */
/* eslint-disable no-async-without-await/no-async-without-await */
import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { render, unmountComponentAtNode } from 'react-dom';
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
  onClose: () => void;
  onSubmit: (date: Date) => void;
  onSendWhenOnline?: () => void;
  isReminder?: boolean;
};

const CommandMenuCalendar = ({
  isOpen, onSubmit, onClose, onSendWhenOnline, isReminder,
}: OwnProps) => {
  const chrono = useMemo(() => new Chrono(), []);
  const [inputValue, setInputValue] = useState('');
  const [menuItems, setMenuItems] = useState<Array<{ label: string; value: string; date: Date | undefined }>>();

  const customFilter = (value: string, search: string) => {
    return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
  };

  const placeholderText = isReminder ? 'Remind me at...' : 'Send at...';

  useEffect(() => {
    return isOpen ? captureKeyboardListeners({ onEsc: onClose }) : undefined;
  }, [isOpen, onClose]);

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

        const formatDate = (date: Date) => {
          // eslint-disable-next-line max-len
          const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          const day = date.getDate();
          const monthIndex = date.getMonth();
          const year = date.getFullYear();

          return `${day} ${months[monthIndex]} ${year}`;
        };

        // В вашем useEffect
        const parsedResults = chrono.parse(inputValue, new Date());
        if (parsedResults.length > 0) {
          const date = parsedResults[0].start.date();
          const timeString = format12HourTime(date);
          const dateString = formatDate(date);
          const newLabel = `Notify me at ${timeString} on ${dateString}`;

          if (!menuItems?.some((item) => item.label === newLabel)) {
            const newItem = { label: newLabel, date, value: inputValue };
            setMenuItems((prevItems) => [...(prevItems ?? []), newItem]);
          }
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
  }, [inputValue, chrono, menuItems]);

  const onValueChange = useCallback((value: string) => {
    setInputValue(value);
    setMenuItems([]);
  }, []);

  const handleSubmission = useCallback((date: Date) => {
    onSubmit(date); // Передаем date напрямую
    onClose(); // Вызов для закрытия меню
  }, [onSubmit, onClose]);

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

  const cmdkRoot = document.getElementById('cmdk-root');

  if (cmdkRoot) {
    if (!isOpen) {
      unmountComponentAtNode(cmdkRoot);
      return null;
    }

    const CommandMenuInner = (
      <Command.Dialog
        label="Calendar Command Menu"
        open={isOpen}
        shouldFilter
        filter={customFilter}
      >
        <Command.Input placeholder={placeholderText} autoFocus onValueChange={onValueChange} />
        <Command.List>
          <Command.Empty>Can not parse data</Command.Empty>
          {menuItems?.map((item, index) => (
            <Command.Item
              key={index}
              value={`${inputValue} ${item.label}`}
              onSelect={() => item.date && handleSubmission(item.date)}
            >
              {item.label}
            </Command.Item>
          ))}
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

    render(CommandMenuInner, cmdkRoot);
  }

  return null;
};

export default CommandMenuCalendar;
