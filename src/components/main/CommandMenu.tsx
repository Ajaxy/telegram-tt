/* eslint-disable arrow-parens */
/* eslint-disable react/no-array-index-key */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable react/jsx-no-bind */
import React from 'react';
import { createRoot } from 'react-dom/client';
// eslint-disable-next-line react/no-deprecated
import { Command, CommandSeparator } from 'cmdk';
import type { FC } from '../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiUser } from '../../api/types';

import { FAQ_URL, SHORTCUTS_URL } from '../../config';
import { getMainUsername, getUserFullName } from '../../global/helpers';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { convertLayout } from '../../util/convertLayout';
import { throttle } from '../../util/schedulers';
import { IS_ARC_BROWSER } from '../../util/windowEnvironment';
import renderText from '../common/helpers/renderText';

import useArchiver from '../../hooks/useArchiver';
import useCommands from '../../hooks/useCommands';
import { useJune } from '../../hooks/useJune';

import './CommandMenu.scss';

const cmdkElement = document.getElementById('cmdk-root');
const cmdkRoot = createRoot(cmdkElement!);
const SEARCH_CLOSE_TIMEOUT_MS = 250;

interface CommandMenuProps {
  topUserIds: string[];
  usersById: Record<string, ApiUser>;
}

const customFilter = (value: string, search: string) => {
  const convertedSearch = convertLayout(search);
  if (value.toLowerCase().includes(search.toLowerCase())
      || value.toLowerCase().includes(convertedSearch.toLowerCase())) {
    return 1; // полное соответствие
  }
  return 0; // нет соответствия
};

interface SuggestedContactsProps {
  topUserIds: string[];
  usersById: Record<string, ApiUser>;
  close: () => void; // Добавляем пропс close
}

const SuggestedContacts: FC<SuggestedContactsProps> = ({ topUserIds, usersById, close }) => {
  const {
    loadTopUsers, openChat, addRecentlyFoundChatId,
  } = getActions();
  const runThrottled = throttle(() => loadTopUsers(), 60000, true);

  useEffect(() => {
    runThrottled();
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [loadTopUsers]);

  const renderName = (userId: string) => {
    const NBSP = '\u00A0';
    const user = usersById[userId];
    const name = Boolean(user) && (getUserFullName(user) || NBSP);
    const handle = Boolean(user) && (getMainUsername(user) || NBSP);
    const renderedName = renderText(name);
    const displayedName = React.isValidElement(renderedName) ? renderedName : name;
    return {
      displayedName: (
        <span>
          <span className="user-name">{displayedName}</span>
          <span className="user-handle">
            {((handle === NBSP) ? '' : '@')}
            {handle}
          </span>
        </span>
      ),
      valueString: `${name} ${handle}`,
    };
  };

  const handleClick = useCallback((id: string) => {
    openChat({ id, shouldReplaceHistory: true });
    setTimeout(() => addRecentlyFoundChatId({ id }), SEARCH_CLOSE_TIMEOUT_MS);
    close();
  }, [openChat, addRecentlyFoundChatId, close]);

  return (
    <Command.Group heading="Suggested contacts">
      {topUserIds.map((userId) => {
        const { displayedName, valueString } = renderName(userId);
        return (
          <Command.Item key={userId} value={valueString} onSelect={() => handleClick(userId)}>
            <span>{displayedName}</span>
          </Command.Item>
        );
      })}
    </Command.Group>
  );
};

interface HomePageProps {
  /* setPages: (pages: string[]) => void; */
  commandArchiveAll: () => void;
  topUserIds: string[];
  usersById: Record<string, ApiUser>;
  handleSearchFocus: () => void;
  handleOpenSavedMessages: () => void;
  handleSelectSettings: () => void;
  handleSelectArchived: () => void;
  handleOpenInbox: () => void;
  menuItems: Array<{ label: string; value: string }>;
  saveAPIKey: () => void;
  close: () => void;
  handleSupport: () => void;
  handleFAQ: () => void;
  handleOpenShortcuts: () => void;
  handleChangelog: () => void;
  handleSelectNewGroup: () => void;
  handleSelectNewChannel: () => void;
  handleCreateFolder: () => void;
}

interface CreateNewPageProps {
  handleSelectNewGroup: () => void;
  handleSelectNewChannel: () => void;
  handleCreateFolder: () => void;
}

const HomePage: React.FC<HomePageProps> = ({
  /* setPages,  */commandArchiveAll, topUserIds, usersById, close,
  handleSearchFocus, handleOpenSavedMessages, handleSelectSettings,
  handleSelectArchived, handleOpenInbox, menuItems, saveAPIKey,
  handleSupport, handleFAQ, handleChangelog, handleSelectNewGroup, handleCreateFolder, handleSelectNewChannel,
  handleOpenShortcuts,
}) => {
  return (
    <>
      {topUserIds && usersById && <SuggestedContacts topUserIds={topUserIds} usersById={usersById} close={close} />}
      <Command.Group heading="Create new...">
        <Command.Item onSelect={handleSelectNewGroup}>
          <i className="icon icon-group" /><span>Create new group</span>
          <span className="shortcuts">
            {IS_ARC_BROWSER ? (
              <>
                <span className="kbd">⌘</span>
                <span className="kbd">G</span>
              </>
            ) : (
              <>
                <span className="kbd">⌘</span>
                <span className="kbd">⇧</span>
                <span className="kbd">C</span>
              </>
            )}
          </span>
        </Command.Item>
        <Command.Item onSelect={handleSelectNewChannel}>
          <i className="icon icon-channel" /><span>Create new channel</span>
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
        {menuItems.map((item, index) => (
          <Command.Item key={index} onSelect={item.value === 'save_api_key' ? saveAPIKey : undefined}>
            {item.label}
          </Command.Item>
        ))}
      </Command.Group>
      <Command.Group heading="Help">
        <Command.Item onSelect={handleFAQ}>
          <i className="icon icon-document" /><span>Open FAQ</span>
        </Command.Item>
        <Command.Item onSelect={handleOpenShortcuts}>
          <i className="icon icon-keyboard" /><span>Keyboard shortcuts</span>
        </Command.Item>
        <Command.Item onSelect={handleSupport}>
          <i className="icon icon-help" /><span>Contact support</span>
        </Command.Item>
        <Command.Item onSelect={handleSupport}>
          <i className="icon icon-ask-support" /><span>Send feedback</span>
        </Command.Item>
      </Command.Group>
      <Command.Group heading="What's new">
        <Command.Item onSelect={handleChangelog}>
          <i className="icon icon-calendar" /><span>Changelog</span>
        </Command.Item>
      </Command.Group>
      <Command.Group heading="Navigation">
        <Command.Item value="$find $search" onSelect={handleSearchFocus}>
          <i className="icon icon-search" /><span>Find chat or contact</span>
          <span className="shortcuts">
            <span className="kbd">⌘</span>
            <span className="kbd">/</span>
          </span>
        </Command.Item>
        <Command.Item onSelect={handleOpenInbox}>
          <i className="icon icon-unread" /><span>Go to inbox</span>
        </Command.Item>
        <Command.Item onSelect={handleOpenSavedMessages}>
          <i className="icon icon-saved-messages" /><span>Go to saved messages</span>
        </Command.Item>
        <Command.Item onSelect={handleSelectArchived}>
          <i className="icon icon-archive-from-main" /><span>Go to archive</span>
        </Command.Item>
        <Command.Item onSelect={handleSelectSettings}>
          <i className="icon icon-settings" /><span>Go to settings</span>
          <span className="shortcuts">
            <span className="kbd">⌘</span>
            <span className="kbd">,</span>
          </span>
        </Command.Item>
      </Command.Group>
    </>
  );
};

const CreateNewPage: React.FC<CreateNewPageProps> = (
  { handleSelectNewGroup, handleSelectNewChannel, handleCreateFolder },
) => {
  return (
    <>
      <Command.Item onSelect={handleSelectNewGroup}>
        <i className="icon icon-group" /><span>Create new group</span>
        <span className="shortcuts">
          {IS_ARC_BROWSER ? (
            <>
              <span className="kbd">⌃</span>
              <span className="kbd">⇧</span>
              <span className="kbd">C</span>
            </>
          ) : (
            <>
              <span className="kbd">⌘</span>
              <span className="kbd">⇧</span>
              <span className="kbd">C</span>
            </>
          )}
        </span>
      </Command.Item>
      <Command.Item onSelect={handleSelectNewChannel}>
        <i className="icon icon-channel" /><span>Create new channel</span>
      </Command.Item>
      <Command.Item onSelect={handleCreateFolder}>
        <i className="icon icon-folder" /><span>Create new folder</span>
      </Command.Item>
    </>
  );
};

const CommandMenu: FC<CommandMenuProps> = ({ topUserIds, usersById }) => {
  const { track } = useJune();
  const {
    showNotification, openUrl, openChatByUsername,
  } = getActions();
  const [isOpen, setOpen] = useState(false);
  /* const [isArchiverEnabled, setIsArchiverEnabled] = useState(
    !!JSON.parse(String(localStorage.getItem('ulu_is_autoarchiver_enabled'))),
  ); */
  const { archiveMessages } = useArchiver({ isManual: true });
  const [inputValue, setInputValue] = useState('');
  const [menuItems, setMenuItems] = useState<Array<{ label: string; value: string }>>([]);
  const { runCommand } = useCommands();
  const [pages, setPages] = useState(['home']);
  const activePage = pages[pages.length - 1];

  const close = useCallback(() => {
    setOpen(false);
    setPages(['home']);
  }, []);

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

  const handleBack = useCallback(() => {
    if (pages.length > 1) {
      const newPages = pages.slice(0, -1);
      setPages(newPages);
    }
  }, [pages]);

  useEffect(() => (
    isOpen ? captureKeyboardListeners({ onEsc: close }) : undefined
  ), [isOpen, close]);

  const saveAPIKey = useCallback(() => {
    localStorage.setItem('openai_api_key', inputValue);
    showNotification({ message: 'The OpenAI API key has been saved.' });
    setOpen(false);
  }, [inputValue]);

  const handleSupport = useCallback(() => {
    openChatByUsername({ username: 'ulugmer' });
    close();
  }, [openChatByUsername, close]);

  const handleFAQ = useCallback(() => {
    openUrl({
      url: FAQ_URL,
      shouldSkipModal: true,
    });
    close();
  }, [openUrl, close]);

  const handleOpenShortcts = useCallback(() => {
    openUrl({
      url: SHORTCUTS_URL,
      shouldSkipModal: true,
    });
    close();
  }, [openUrl, close]);

  const handleChangelog = useCallback(() => {
    openChatByUsername({ username: 'uludotso' });
    close();
  }, [openChatByUsername, close]);

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

  const handleSearchFocus = useCallback(() => {
    runCommand('OPEN_SEARCH');
    close();
  }, [runCommand, close]);

  const handleSelectSettings = useCallback(() => {
    runCommand('OPEN_SETTINGS');
    close();
  }, [runCommand, close]);

  const handleSelectArchived = useCallback(() => {
    runCommand('OPEN_ARCHIVED');
    close();
  }, [runCommand, close]);

  const handleOpenInbox = useCallback(() => {
    runCommand('OPEN_INBOX');
    close();
  }, [runCommand, close]);

  const handleOpenSavedMessages = useCallback(() => {
    runCommand('OPEN_SAVED');
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

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (IS_ARC_BROWSER && (e.metaKey || e.ctrlKey) && e.code === 'KeyG') {
        handleSelectNewGroup();
        e.preventDefault();
        e.stopPropagation();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyC') {
        handleSelectNewGroup();
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [handleSelectNewGroup]);

  const CommandMenuInner = (
    <Command.Dialog
      label="Command Menu"
      open={isOpen}
      onOpenChange={setOpen}
      loop
      shouldFilter
      filter={customFilter}
    >
      <Command.Input
        placeholder="Search for command..."
        autoFocus
        onValueChange={handleInputChange}
        value={inputValue}
        onKeyDown={(e) => {
          if (e.key === 'Backspace') {
            handleBack();
          }
        }}
      />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>
        {activePage === 'home' && (
          <HomePage
            /* setPages={setPages} */
            commandArchiveAll={commandArchiveAll}
            topUserIds={topUserIds}
            usersById={usersById}
            handleSearchFocus={handleSearchFocus}
            handleSelectSettings={handleSelectSettings}
            handleOpenInbox={handleOpenInbox}
            handleSelectArchived={handleSelectArchived}
            handleOpenSavedMessages={handleOpenSavedMessages}
            saveAPIKey={saveAPIKey}
            menuItems={menuItems}
            handleSupport={handleSupport}
            handleFAQ={handleFAQ}
            handleOpenShortcuts={handleOpenShortcts}
            handleChangelog={handleChangelog}
            close={close}
            handleSelectNewGroup={handleSelectNewGroup}
            handleSelectNewChannel={handleSelectNewChannel}
            handleCreateFolder={handleCreateFolder}
          />
        )}
        {activePage === 'createNew' && (
          <CreateNewPage
            handleSelectNewGroup={handleSelectNewGroup}
            handleSelectNewChannel={handleSelectNewChannel}
            handleCreateFolder={handleCreateFolder}
          />
        )}
      </Command.List>
    </Command.Dialog>
  );

  cmdkRoot.render(CommandMenuInner);
  return <div />;
};

export default memo(withGlobal(
  (global): { topUserIds?: string[]; usersById: Record<string, ApiUser> } => {
    const { userIds: topUserIds } = global.topPeers;
    const usersById = global.users.byId;

    return { topUserIds, usersById };
  },
)(CommandMenu));
