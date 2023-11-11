/* eslint-disable react/jsx-no-bind */
/* eslint-disable react/no-deprecated */
/* eslint-disable no-console */
import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { render } from 'react-dom';
import { Chrono } from 'chrono-node';
import { Command } from 'cmdk';
import {
  useCallback, useEffect, useMemo,
  useState,
} from '../../lib/teact/teact';

import '../main/CommandMenu.scss';

const cmdkRoot = document.getElementById('cmdk-root');

export type OwnProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (date: Date) => void;
  onSendWhenOnline?: () => void;
};

const CommandMenuCalendar = ({
  isOpen, onClose, onSubmit, onSendWhenOnline,
}: OwnProps) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const chrono = useMemo(() => new Chrono(), []);

  const tomorrowAt9am = useMemo(() => {
    const parsedResults = chrono.parse('Tomorrow at 9am', new Date());
    if (parsedResults.length > 0) {
      return parsedResults[0].start.date();
    }
    return undefined;
  }, [chrono]);

  // Логируем изменения inputValue и selectedDate
  useEffect(() => {
    console.log('Обработка ввода пользователя:', inputValue);
    const results = chrono.parse(inputValue, new Date());
    if (results.length > 0) {
      const date = results[0].start.date();
      console.log('Распознанная дата:', date);
      setSelectedDate(date); // Устанавливаем распознанную дату
    } else {
      setSelectedDate(undefined); // Сбрасываем дату
    }
  }, [inputValue, chrono]);

  // Логируем изменения selectedDate
  useEffect(() => {
    console.log('Текущая выбранная дата:', selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  const onValueChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const handleSubmission = useCallback((date: Date) => {
    console.log('handleSubmission вызвана с датой:', date);
    onSubmit(date); // Передаем date напрямую
    console.log('Попытка закрыть меню из handleSubmission');
    onClose(); // Вызов для закрытия меню
  }, [onSubmit, onClose]);

  const handleTomorrowAt9amSelect = useCallback(() => {
    if (tomorrowAt9am) {
      handleSubmission(tomorrowAt9am);
    } else {
      console.error("Ошибка: Дата 'Завтра в 9 утра' не определена");
      // Обработка ошибки или альтернативное действие
    }
  }, [tomorrowAt9am, handleSubmission]);

  // Если меню не открыто, не рендерим его содержимое
  if (!isOpen) {
    return undefined;
  }

  const CommandMenuInner = (
    <Command.Dialog label="Calendar Command Menu" open={isOpen}>
      <Command.Input placeholder="Remind me at..." autoFocus onValueChange={onValueChange} />
      <Command.List>
        {tomorrowAt9am && (
          <Command.Item onSelect={handleTomorrowAt9amSelect}>
            Tomorrow at 9 am
          </Command.Item>
        )}
        {selectedDate && (
          <Command.Item onSelect={() => handleSubmission(selectedDate)}>
            Remind me at {selectedDate.toDateString()}
          </Command.Item>
        )}
        {onSendWhenOnline && (
          <Command.Item onSelect={onSendWhenOnline}>
            Send when online
          </Command.Item>
        )}
      </Command.List>
    </Command.Dialog>
  );

  render(CommandMenuInner, cmdkRoot);
  return undefined;
};

export default CommandMenuCalendar;
