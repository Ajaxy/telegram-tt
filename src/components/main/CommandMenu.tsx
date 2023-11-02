import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { render } from 'react-dom';
import { Command } from 'cmdk';
import {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import './CommandMenu.scss';

const cmdkRoot = document.getElementById('cmdk-root');

const CommandMenu = () => {
  const { showNotification } = getActions();
  const [open, setOpen] = useState(false);
  const [isArchiverEnabled, setIsArchiverEnabled] = useState(
    !!JSON.parse(String(localStorage.getItem('ulu_is_archiver_enabled'))),
  );

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') {
        setOpen(!open);
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.code === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      close();
    }
  }, [close]);

  const commandToggleArchiver = useCallback(() => {
    const updIsArchiverEnabled = !isArchiverEnabled;
    showNotification({ message: updIsArchiverEnabled ? 'Archiver enabled!' : 'Archiver disabled!' });
    localStorage.setItem('ulu_is_archiver_enabled', JSON.stringify(updIsArchiverEnabled));
    setIsArchiverEnabled(updIsArchiverEnabled);
    close();
  }, [close, isArchiverEnabled]);

  const commandArchiveAll = useCallback(() => {
    showNotification({ message: 'All older than 24 hours will be archived!' });
    close();
  }, [close]);

  const CommandMenuInner = open ? (
    <Command label="Command Menu">
      <Command.Input
        placeholder="Search for command..."
        autoFocus
        onBlur={close}
        onKeyDown={onKeyDown}
      />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>
        <Command.Group heading="Archiver">
          <Command.Item onSelect={commandToggleArchiver}>
            {isArchiverEnabled
              ? 'Disable Archiver'
              : 'Enable Archiver'}
          </Command.Item>
          <Command.Item onSelect={commandArchiveAll}>Archive all older than 24 hours</Command.Item>
        </Command.Group>
      </Command.List>
    </Command>
  ) : <div />;

  render(CommandMenuInner, cmdkRoot);
  return <div />;
};

export default memo(CommandMenu);
