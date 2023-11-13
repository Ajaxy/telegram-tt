/* eslint-disable react/no-array-index-key */
/* eslint-disable no-async-without-await/no-async-without-await */
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
  const chrono = useMemo(() => new Chrono(), []);
  const [inputValue, setInputValue] = useState('');
  const [menuItems, setMenuItems] = useState<Array<{ label: string; date: Date | undefined }>>();
  const [loading, setLoading] = useState(false);

  const filterItems = (item: { label: string; date: Date | undefined }) => {
    const inputLower = inputValue.toLowerCase();

    // Преобразуем дату обратно в строку для сравнения
    const dateString = item.date ? item.date.toDateString().toLowerCase() : '';

    return item.label.toLowerCase().includes(inputLower) || dateString.includes(inputLower);
  };
  const tomorrowAt9am = useMemo(() => {
    const parsedResults = chrono.parse('Tomorrow at 9am', new Date());
    if (parsedResults.length > 0) {
      return parsedResults[0].start.date();
    }
    return undefined;
  }, [chrono]);

  useEffect(() => {
    const processInput = async () => {
      setLoading(true);
      const parsedResults = chrono.parse(inputValue, new Date());
      if (parsedResults.length > 0) {
        const date = parsedResults[0].start.date();
        const newLabel = `Remind me at ${date.toDateString()}`;

        // Проверяем, существует ли уже такой элемент в меню
        if (!menuItems?.some((item) => item.label === newLabel)) {
          const newItem = { label: newLabel, date };
          setMenuItems((prevItems) => [...(prevItems ?? []), newItem]);
        }
      }
      setLoading(false);
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
  }, []);

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
        {loading && <Command.Loading>Processing input...</Command.Loading>}
        {menuItems?.filter(filterItems).map((item, index) => (
          <Command.Item key={index} value={item.label} onSelect={() => item.date && handleSubmission(item.date)}>
            {item.label}
          </Command.Item>
        ))}
        <Command.Item onSelect={handleTomorrowAt9amSelect}>
          Tomorrow at 9 am
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
  return undefined;
};

export default CommandMenuCalendar;
