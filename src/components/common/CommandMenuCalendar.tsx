/* eslint-disable react/jsx-no-bind */
/* eslint-disable react/no-deprecated */
/* eslint-disable no-console */
import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { render } from 'react-dom';
import { Chrono } from 'chrono-node';
import { Command } from 'cmdk';
import {
  useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';

import captureKeyboardListeners from '../../util/captureKeyboardListeners';

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

  useEffect(() => {
    console.log('Изменение isOpen в CommandMenuCalendar:', isOpen);
    if (!isOpen) {
      setInputValue('');
      setSelectedDate(undefined);
    }
  }, [isOpen]);

  useEffect(() => {
    try {
      console.log('Обработка ввода пользователя:', inputValue);
      const results = chrono.parse(inputValue, new Date());
      if (results.length > 0) {
        const date = results[0].start.date();
        console.log('Распознанная дата:', date);
        setSelectedDate(date);
      } else {
        setSelectedDate(undefined);
      }
    } catch (error) {
      console.error('Ошибка при анализе даты: ', error);
      setSelectedDate(undefined);
    }
  }, [inputValue, chrono]);

  useEffect(() => (
    isOpen ? captureKeyboardListeners({ onEsc: onClose }) : undefined
  ), [isOpen, onClose]);

  const handleSubmission = useCallback((date: Date) => {
    console.log('handleSubmission вызвана с датой:', date);
    onSubmit(date); // Передаем date напрямую
    onClose();
  }, [onSubmit, onClose]);

  const handleTomorrowAt9amSelect = useCallback(() => {
    if (tomorrowAt9am) {
      handleSubmission(tomorrowAt9am);
    } else {
      console.error("Ошибка: Дата 'Завтра в 9 утра' не определена");
      // Обработка ошибки или альтернативное действие
    }
  }, [tomorrowAt9am, handleSubmission]);

  useEffect(() => {
    console.log('Значение tomorrowAt9am:', tomorrowAt9am);
  }, [tomorrowAt9am]);

  const onValueChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  if (!isOpen) {
    console.log('Меню закрыто');
    return undefined;
  }

  const CommandMenuInner = (
    <Command.Dialog label="Command Menu" open={isOpen}>
      <Command.Input
        placeholder="Remind me at..."
        autoFocus
        onValueChange={onValueChange}
      />
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
            Отправить, когда онлайн
          </Command.Item>
        )}
      </Command.List>
    </Command.Dialog>
  );

  render(CommandMenuInner, cmdkRoot);
  return <div />;
};

export default CommandMenuCalendar;
