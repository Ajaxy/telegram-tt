/* eslint-disable react/no-deprecated */
/* eslint-disable no-console */
import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { render } from 'react-dom';
import { Chrono } from 'chrono-node';
import { Command } from 'cmdk';

import './CommandMenu.scss';

const cmdkRoot = document.getElementById('cmdk-root');

interface CommandMenuCalendarProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (date: Date) => void;
  onSendWhenOnline?: () => void;
}

const CommandMenuCalendar = ({
  isOpen, onClose, onSubmit, onSendWhenOnline,
}: CommandMenuCalendarProps) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const chrono = useMemo(() => new Chrono(), []);

  useEffect(() => {
    if (!isOpen) {
      setInputValue('');
      setSelectedDate(undefined);
    }
  }, [isOpen]);

  useEffect(() => {
    try {
      const results = chrono.parse(inputValue, new Date());
      if (results.length > 0) {
        const date = results[0].start.date();
        setSelectedDate(date);
      } else {
        setSelectedDate(undefined);
      }
    } catch (error) {
      console.error('Ошибка при анализе даты: ', error);
      setSelectedDate(undefined);
    }
  }, [inputValue, chrono]);

  const handleSubmission = useCallback(() => {
    if (selectedDate) {
      onSubmit(selectedDate);
      onClose();
    } else {
      console.log('Дата не выбрана или не распознана');
    }
  }, [selectedDate, onSubmit, onClose]);

  const onValueChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const CommandMenuInner = (
    <Command.Dialog label="Command Menu" open={isOpen}>
      <Command.Input
        placeholder="Введите дату..."
        autoFocus
        onValueChange={onValueChange}
      />
      <Command.List>
        <Command.Item onSelect={handleSubmission}>
          Подтвердить выбранную дату: {selectedDate ? selectedDate.toDateString() : 'Нет даты'}
        </Command.Item>
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

export default React.memo(CommandMenuCalendar);
