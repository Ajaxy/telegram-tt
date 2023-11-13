/* eslint-disable arrow-parens */
/* eslint-disable react/no-array-index-key */
/* eslint-disable react/jsx-no-bind */
import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { render } from 'react-dom';
// eslint-disable-next-line react/no-deprecated
import { Command } from 'cmdk';
import {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import captureKeyboardListeners from '../../util/captureKeyboardListeners';

import useArchiver from '../../hooks/useArchiver';
import { useJune } from '../../hooks/useJune';

import './CommandMenu.scss';

const cmdkRoot = document.getElementById('cmdk-root');

const CommandMenu = () => {
  const { track } = useJune();
  const { showNotification } = getActions();
  const [isOpen, setOpen] = useState(false);
  const [isArchiverEnabled, setIsArchiverEnabled] = useState(
    !!JSON.parse(String(localStorage.getItem('ulu_is_autoarchiver_enabled'))),
  );
  const { archiveMessages } = useArchiver({ isManual: true });
  const [inputValue, setInputValue] = useState('');
  const [menuItems, setMenuItems] = useState<Array<{ label: string; value: string }>>([]);

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

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
  };

  useEffect(() => {
    if (inputValue.length === 51) {
      // Создаем пункт меню для сохранения ключа
      const newLabel = `Save/update OpenAI key: ${inputValue}`;
      const newItem = { label: newLabel, value: 'save_api_key' };

      if (!menuItems.some(item => item.label === newLabel)) {
        setMenuItems(prevItems => [...prevItems, newItem]);
      }
    } else {
      setMenuItems([]); // Очищаем пункты меню, если ключ невалиден
    }
  }, [inputValue, menuItems]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => (
    isOpen ? captureKeyboardListeners({ onEsc: close }) : undefined
  ), [isOpen, close]);

  const saveAPIKey = useCallback(() => {
    localStorage.setItem('openai_api_key', JSON.stringify(inputValue));
    showNotification({ message: 'The OpenAI API key has been saved.' });
    setOpen(false);
  }, [inputValue]);

  const customFilter = (value: string, search: string) => {
    return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
  };

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

  const CommandMenuInner = (
    <Command.Dialog label="Command Menu" open={isOpen} onOpenChange={setOpen} filter={customFilter} shouldFilter>
      <Command.Input
        placeholder="Search for command..."
        autoFocus
        onValueChange={handleInputChange}
        value={inputValue}
      />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>
        <Command.Group heading="Archiver">
          <Command.Item onSelect={commandToggleArchiver}>
            {isArchiverEnabled
              ? 'Disable auto-mark as "Done" after reading'
              : 'Enable auto-mark as "Done" after reading'}
          </Command.Item>
          <Command.Item onSelect={commandArchiveAll}>
            Mark read chats as &quot;Done&quot; (May take ~1-3 min)
          </Command.Item>
          {menuItems.map((item, index) => (
            <Command.Item key={index} onSelect={item.value === 'save_api_key' ? saveAPIKey : undefined}>
              {item.label}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );

  render(CommandMenuInner, cmdkRoot);
  return <div />;
};

export default memo(CommandMenu);
