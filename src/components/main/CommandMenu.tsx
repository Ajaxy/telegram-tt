import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { render } from 'react-dom';
// eslint-disable-next-line react/no-deprecated
import { Command } from 'cmdk';
import {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import useArchiver from '../../hooks/useArchiver';

import './CommandMenu.scss';

const cmdkRoot = document.getElementById('cmdk-root');

const CommandMenu = () => {
  const { showNotification } = getActions();
  const [open, setOpen] = useState(false);
  const [isArchiverEnabled, setIsArchiverEnabled] = useState(
    !!JSON.parse(String(localStorage.getItem('ulu_is_archiver_enabled'))),
  );
  const { archive24hMessages } = useArchiver({ isAutoarchiverMode: false });

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.code === 'KeyK') {
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
    archive24hMessages();
    close();
  }, [close, archive24hMessages]);

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
              ? 'Disable auto-mark as "Done" after reading'
              : 'Enable auto-mark as "Done" after reading'}
          </Command.Item>
          <Command.Item onSelect={commandArchiveAll}>Mark read chats as &quot;Done&quot; (Over 24h Old)</Command.Item>
        </Command.Group>
      </Command.List>
    </Command>
  ) : <div />;

  render(CommandMenuInner, cmdkRoot);
  return <div />;
};

export default memo(CommandMenu);
