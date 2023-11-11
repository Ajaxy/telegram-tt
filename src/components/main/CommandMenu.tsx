/* eslint-disable no-console */
/* eslint-disable react/jsx-no-bind */
/* eslint-disable max-len */
import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { render } from 'react-dom';
import { Chrono } from 'chrono-node';
// eslint-disable-next-line react/no-deprecated
import { Command } from 'cmdk';
import {
  memo, useCallback, useEffect, useMemo,
  useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import captureKeyboardListeners from '../../util/captureKeyboardListeners';

import useArchiver from '../../hooks/useArchiver';
import { useJune } from '../../hooks/useJune';

import './CommandMenu.scss';

const cmdkRoot = document.getElementById('cmdk-root');

const CommandMenu = () => {
  const [inputValue, setInputValue] = useState('');
  const [parsedDate, setParsedDate] = useState('');
  const chrono = useMemo(() => new Chrono(), []);
  const { track } = useJune();
  const { showNotification } = getActions();
  const [isOpen, setOpen] = useState(false);
  const [isArchiverEnabled, setIsArchiverEnabled] = useState(
    !!JSON.parse(String(localStorage.getItem('ulu_is_autoarchiver_enabled'))),
  );
  const { archiveMessages } = useArchiver({ isManual: true });

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.code === 'KeyK') {
        setOpen(!isOpen);
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [isOpen]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => (
    isOpen ? captureKeyboardListeners({ onEsc: close }) : undefined
  ), [isOpen, close]);

  const commandToggleArchiver = useCallback(() => {
    const updIsArchiverEnabled = !isArchiverEnabled;
    showNotification({ message: updIsArchiverEnabled ? 'Archiver enabled!' : 'Archiver disabled!' });
    localStorage.setItem('ulu_is_autoarchiver_enabled', JSON.stringify(updIsArchiverEnabled));
    setIsArchiverEnabled(updIsArchiverEnabled);
    close();
  }, [close, isArchiverEnabled]);

  const commandArchiveAll = useCallback(() => {
    showNotification({ message: 'All older than 24 hours will be archived!' });
    archiveMessages();
    close();
    if (track) {
      track('commandArchiveAll');
    }
  }, [close, archiveMessages, track]);

  useEffect(() => {
    console.log('Значение inputValue:', inputValue);
    try {
      const adjustedInput = `${inputValue} `;
      const results = chrono.parse(adjustedInput, new Date());
      console.log('Результаты chrono.parse:', results);
      if (results.length > 0) {
        const date = results[0].start.date();
        console.log('Дата распознана:', date);
        setParsedDate(date.toString());
      } else {
        console.log('Дата не распознана');
        setParsedDate('Дата не распознана');
      }
    } catch (error) {
      console.error('Ошибка при анализе даты: ', error);
      setParsedDate('Ошибка при анализе');
    }
  }, [inputValue, chrono]);

  const CommandMenuInner = (
    <Command.Dialog label="Command Menu" open={isOpen} onOpenChange={setOpen}>
      <Command.Input
        placeholder="Search for command..."
        autoFocus
        onValueChange={(value) => setInputValue(value)}
      />
      <Command.List>
        {parsedDate && (
          <Command.Item>
            Распознанная дата: {parsedDate}
          </Command.Item>
        )}
        <Command.Empty>No commands found.</Command.Empty>
        <Command.Group heading="Archiver">
          <Command.Item onSelect={commandToggleArchiver}>
            {isArchiverEnabled
              ? 'Disable auto-mark as "Done" after reading'
              : 'Enable auto-mark as "Done" after reading'}
          </Command.Item>
          <Command.Item onSelect={commandArchiveAll}>
            Mark read chats as &quot;Done&quot; (May take ~1-3 min)
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );

  render(CommandMenuInner, cmdkRoot);
  return <div />;
};

export default memo(CommandMenu);
