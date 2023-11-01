import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { render } from 'react-dom';
import { Command } from 'cmdk';
import { memo, useEffect, useState } from '../../lib/teact/teact';

import './CommandMenu.scss';

const CommandMenuInner = (
  <Command label="Command Menu">
    <Command.Input />
    <Command.List>
      <Command.Empty>No results found.</Command.Empty>
      <Command.Group heading="Archiver">
        <Command.Item>Toggle archiver</Command.Item>
        <Command.Item>Archive all</Command.Item>
      </Command.Group>
    </Command.List>
  </Command>
);

const cmdkRoot = document.getElementById('cmdk-root');

const CommandMenu = () => {
  const [open, setOpen] = useState(false);

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') {
        setOpen(!open);
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open]);

  render(CommandMenuInner, cmdkRoot);
  return <div />;
};

export default memo(CommandMenu);
