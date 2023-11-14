import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { render } from 'react-dom';
// eslint-disable-next-line react/no-deprecated
import { Command, CommandSeparator } from 'cmdk';
import {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import captureKeyboardListeners from '../../util/captureKeyboardListeners';

import useArchiver from '../../hooks/useArchiver';
import useCommands from '../../hooks/useCommands';
import { useJune } from '../../hooks/useJune';

import './CommandMenu.scss';

const cmdkRoot = document.getElementById('cmdk-root');

const CommandMenu = () => {
  const { track } = useJune();
  const { showNotification } = getActions();
  const [isOpen, setOpen] = useState(false);
  /* const [isArchiverEnabled, setIsArchiverEnabled] = useState(
    !!JSON.parse(String(localStorage.getItem('ulu_is_autoarchiver_enabled'))),
  ); */
  const { archiveMessages } = useArchiver({ isManual: true });
  const { runCommand } = useCommands();

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

  const handleSelectNewChannel = useCallback(() => {
    runCommand('NEW_CHANNEL');
    close();
  }, [runCommand, close]);

  const handleSelectNewGroup = useCallback(() => {
    runCommand('NEW_GROUP');
    close();
  }, [runCommand, close]);

  const handleCreateFolder = useCallback(() => {
    runCommand('NEW_FOLDER');
    close();
  }, [runCommand, close]);

  /* const commandToggleArchiver = useCallback(() => {
    const updIsArchiverEnabled = !isArchiverEnabled;
    showNotification({ message: updIsArchiverEnabled ? 'Archiver enabled!' : 'Archiver disabled!' });
    localStorage.setItem('ulu_is_autoarchiver_enabled', JSON.stringify(updIsArchiverEnabled));
    setIsArchiverEnabled(updIsArchiverEnabled);
    close();
  }, [close, isArchiverEnabled]); */

  const commandArchiveAll = useCallback(() => {
    showNotification({ message: 'All older than 24 hours will be archived!' });
    archiveMessages();
    close();
    if (track) {
      track('commandArchiveAll');
    }
  }, [close, archiveMessages, track]);

  const CommandMenuInner = (
    <Command.Dialog label="Command Menu" open={isOpen} onOpenChange={setOpen} loop>
      <Command.Input
        placeholder="Search for command..."
        autoFocus
      />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>
        <Command.Group heading="Create new...">
          <Command.Item onSelect={handleSelectNewChannel}>
            <i className="icon icon-channel" /><span>Create new channel</span>
          </Command.Item>
          <Command.Item onSelect={handleSelectNewGroup}>
            <i className="icon icon-group" /><span>Create new group</span>
          </Command.Item>
          <Command.Item onSelect={handleCreateFolder}>
            <i className="icon icon-folder" /><span>Create new folder</span>
          </Command.Item>
        </Command.Group>
        <CommandSeparator />
        <Command.Group heading="Settings">
          <Command.Item onSelect={commandArchiveAll}>
            <i className="icon icon-archive" /><span>Mark read chats as &quot;Done&quot; (May take ~1-3 min)</span>
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );

  render(CommandMenuInner, cmdkRoot);
  return <div />;
};

export default memo(CommandMenu);
