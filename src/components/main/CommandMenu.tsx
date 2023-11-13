/* eslint-disable max-len */
import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { render } from 'react-dom';
// eslint-disable-next-line react/no-deprecated
import { Command, CommandSeparator } from 'cmdk';
import {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { FolderEditDispatch } from '../../hooks/reducers/useFoldersReducer';
import type { LeftColumnContent } from '../../types';
import { SettingsScreens } from '../../types';

import captureKeyboardListeners from '../../util/captureKeyboardListeners';

import useArchiver from '../../hooks/useArchiver';
import { useJune } from '../../hooks/useJune';

import { selectNewChannel, selectNewGroup } from '../left/main/LeftMainHendlers';

import './CommandMenu.scss';

const cmdkRoot = document.getElementById('cmdk-root');

interface CommandMenuProps {
  onContentChange: (content: LeftColumnContent) => void;
  onScreenSelect: (screen: SettingsScreens) => void;
  dispatch: FolderEditDispatch;
}

const CommandMenu: React.FC<CommandMenuProps> = ({ onContentChange, dispatch, onScreenSelect }) => {
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

  const handleSelectNewChannel = useCallback(() => {
    selectNewChannel(onContentChange)();
    close();
  }, [onContentChange, close]);

  const handleSelectNewGroup = useCallback(() => {
    selectNewGroup(onContentChange)();
    close();
  }, [onContentChange, close]);

  const handleCreateFolder = useCallback(() => {
    dispatch({ type: 'reset' });
    onScreenSelect(SettingsScreens.FoldersCreateFolder);
    close();
  }, [onScreenSelect, dispatch, close]);

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
    <Command.Dialog label="Command Menu" open={isOpen} onOpenChange={setOpen} loop>
      <Command.Input
        placeholder="Search for command..."
        autoFocus
      />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>
        <Command.Group heading="Create new...">
          <Command.Item onSelect={handleSelectNewChannel}>Create new channel</Command.Item>
          <Command.Item onSelect={handleSelectNewGroup}>Create new group</Command.Item>
          <Command.Item onSelect={handleCreateFolder}>Create new folder</Command.Item>
        </Command.Group>
        <CommandSeparator />
        <Command.Group heading="Settings">
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
