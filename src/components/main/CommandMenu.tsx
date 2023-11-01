import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { render } from 'react-dom';
import { Command } from 'cmdk';
import {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';

import './CommandMenu.scss';

const cmdkRoot = document.getElementById('cmdk-root');

const CommandMenu = () => {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const toggleArchiver = useCallback(() => {
    // eslint-disable-next-line no-console
    console.log('toggleArchiver');
    close();
  }, [close]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.code === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      close();
    }
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
          <Command.Item onSelect={toggleArchiver}>Toggle auto-archiver</Command.Item>
          <Command.Item onSelect={toggleArchiver}>Archive all older than 24 hours</Command.Item>
        </Command.Group>
      </Command.List>
    </Command>
  ) : <div />;

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

  render(CommandMenuInner, cmdkRoot);
  return <div />;
};

export default memo(CommandMenu);
