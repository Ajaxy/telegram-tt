/* eslint-disable no-console */
/* eslint-disable react/no-array-index-key */
/* eslint-disable react/jsx-no-bind */
import React from 'react';
import { createRoot } from 'react-dom/client';
// eslint-disable-next-line react/no-deprecated
import { Command, CommandSeparator } from 'cmdk';
import type { FC } from '../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getGlobal } from '../../lib/teact/teactn';
import { getActions, withGlobal } from '../../global';

import type { ApiChat, ApiChatFolder, ApiUser } from '../../api/types';
import type { GlobalState } from '../../global/types';

import { FAQ_URL, SHORTCUTS_URL } from '../../config';
import {
  getChatTitle, getChatTypeString, getMainUsername, getUserFullName, isDeletedUser,
} from '../../global/helpers';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { convertLayout } from '../../util/convertLayout';
import { throttle } from '../../util/schedulers';
import { IS_APP, IS_ARC_BROWSER } from '../../util/windowEnvironment';
import renderText from '../common/helpers/renderText';

import useArchiver from '../../hooks/useArchiver';
import useCommands from '../../hooks/useCommands';
import { useJune } from '../../hooks/useJune';
import useLang from '../../hooks/useLang';

import AllUsersAndChats from '../common/AllUsersAndChats';
import FolderPage from '../common/FolderPage';
import AutomationSettings from './AutomationSettings';

import './CommandMenu.scss';

const cmdkElement = document.getElementById('cmdk-root');
const cmdkRoot = createRoot(cmdkElement!);
const SEARCH_CLOSE_TIMEOUT_MS = 250;

interface CommandMenuProps {
  topUserIds?: string[];
  usersById: Record<string, ApiUser>;
  folders: ApiChatFolder[];
  chatsById?: Record<string, ApiChat>;
  recentlyFoundChatIds?: string[];
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
  topUserIds?: string[];
  usersById: Record<string, ApiUser>;
  chatsById?: Record<string, ApiChat>;
  recentlyFoundChatIds?: string[];
  close: () => void; // Добавляем пропс close
}

const SuggestedContacts: FC<SuggestedContactsProps> = ({
  topUserIds, usersById, chatsById, recentlyFoundChatIds, close,
}) => {
  const {
    loadTopUsers, openChat, addRecentlyFoundChatId,
  } = getActions();
  const runThrottled = throttle(() => loadTopUsers(), 60000, true);
  const lang = useLang();
  const uniqueTopUserIds = topUserIds?.filter((id) => !recentlyFoundChatIds?.slice(0, 2).includes(id)) || [];
  function getGroupStatus(chat: ApiChat) {
    const chatTypeString = lang(getChatTypeString(chat));
    const { membersCount } = chat;

    if (chat.isRestricted) {
      return chatTypeString === 'Channel' ? 'channel is inaccessible' : 'group is inaccessible';
    }

    if (!membersCount) {
      return chatTypeString;
    }

    return chatTypeString === 'Channel'
      ? lang('Subscribers', membersCount, 'i')
      : lang('Members', membersCount, 'i');
  }

  useEffect(() => {
    runThrottled();
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [loadTopUsers]);

  const renderName = (id: string, isUser: boolean, isChat: boolean): { content: React.ReactNode; value: string } => {
    const NBSP = '\u00A0';
    let content: React.ReactNode;
    let value = '';

    if (isUser) {
      const user = usersById[id] as ApiUser;
      if (isDeletedUser(user)) {
        return { content: undefined, value: '' };
      }
      const name = getUserFullName(user) || NBSP;
      const handle = getMainUsername(user) || NBSP;
      const renderedName = renderText(name);
      content = React.isValidElement(renderedName) ? renderedName : (
        <span>
          <span className="entity-name">{name}</span>
          <span className="user-handle">{handle !== NBSP ? `@${handle}` : ''}</span>
        </span>
      );
      value = `${name} ${handle !== NBSP ? handle : ''}`.trim();
    } else if (isChat && chatsById) {
      const chat = chatsById[id] as ApiChat;
      if (chat) {
        const title = getChatTitle(lang, chat) || 'Unknown Chat';
        const groupStatus = getGroupStatus(chat);
        content = (
          <span>
            <span className="chat-title">{title}</span>
            <span className="chat-status">{groupStatus}</span>
          </span>
        );
        value = title;
      }
    }

    return { content, value };
  };

  const handleClick = useCallback((id: string) => {
    openChat({ id, shouldReplaceHistory: true });
    setTimeout(() => addRecentlyFoundChatId({ id }), SEARCH_CLOSE_TIMEOUT_MS);
    close();
  }, [openChat, addRecentlyFoundChatId, close]);

  return (
    <Command.Group heading="Suggestions">
      {recentlyFoundChatIds && recentlyFoundChatIds.slice(0, 2).map((id) => {
        const isUser = usersById.hasOwnProperty(id);
        const isChat = !!chatsById && chatsById.hasOwnProperty(id); // Используйте !! для приведения к boolean
        const { content, value } = renderName(id, isUser, isChat);

        return content && (
          <Command.Item key={id} value={value} onSelect={() => handleClick(id)}>
            {content}
          </Command.Item>
        );
      })}
      {uniqueTopUserIds && uniqueTopUserIds.slice(0, 3).map((id) => {
        const isUser = usersById.hasOwnProperty(id);
        const isChat = !!chatsById && chatsById.hasOwnProperty(id); // Используйте !! для приведения к boolean
        const { content, value } = renderName(id, isUser, isChat);
        return content && (
          <Command.Item key={id} value={value} onSelect={() => handleClick(id)}>
            {content}
          </Command.Item>
        );
      })}
    </Command.Group>
  );
};

interface HomePageProps {
  commandArchiveAll: () => void;
  topUserIds?: string[];
  usersById: Record<string, ApiUser>;
  recentlyFoundChatIds?: string[];
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
  handleLockScreenHotkey: () => void;
  commandToggleArchiver: () => void;
  handleOpenAutomationSettings: () => void;
}

interface CreateNewPageProps {
  handleSelectNewGroup: () => void;
  handleSelectNewChannel: () => void;
  handleCreateFolder: () => void;
}

const HomePage: React.FC<HomePageProps> = ({
  commandArchiveAll, topUserIds, usersById, recentlyFoundChatIds, close,
  handleSearchFocus, handleOpenSavedMessages, handleSelectSettings,
  handleSelectArchived, handleOpenInbox, menuItems, saveAPIKey,
  handleSupport, handleFAQ, handleChangelog, handleSelectNewGroup, handleCreateFolder, handleSelectNewChannel,
  handleOpenShortcuts, handleLockScreenHotkey, commandToggleArchiver, handleOpenAutomationSettings,
}) => {
  return (
    <>
      {topUserIds && usersById && (
        <SuggestedContacts
          topUserIds={topUserIds}
          usersById={usersById}
          recentlyFoundChatIds={recentlyFoundChatIds}
          close={close}
        />
      )}
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
        <Command.Item onSelect={commandToggleArchiver}>
          <i className="icon icon-readchats" /><span>Auto-Done After Reading</span>
        </Command.Item>
        {menuItems.map((item, index) => (
          <Command.Item key={index} onSelect={item.value === 'save_api_key' ? saveAPIKey : undefined}>
            {item.label}
          </Command.Item>
        ))}
        <Command.Item onSelect={handleOpenAutomationSettings}>
          <span>Open Automation Settings</span>
        </Command.Item>
      </Command.Group>
      <Command.Group heading="Help">
        <Command.Item onSelect={handleFAQ}>
          <i className="icon icon-document" /><span>Help center</span>
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
        {
          IS_APP && (
            <Command.Item onSelect={handleLockScreenHotkey}>
              <i className="icon icon-lock" /><span>Lock screen</span>
              <span className="shortcuts">
                <span className="kbd">⌘</span>
                <span className="kbd">L</span>
              </span>
            </Command.Item>
          )
        }
        <Command.Item onSelect={handleOpenInbox}>
          <i className="icon icon-unread" /><span>Go to inbox</span>
        </Command.Item>
        <Command.Item onSelect={handleOpenSavedMessages}>
          <i className="icon icon-saved-messages" /><span>Go to saved messages</span>
          <span className="shortcuts">
            <span className="kbd">⌘</span>
            <span className="kbd">0</span>
          </span>
        </Command.Item>
        <Command.Item onSelect={handleSelectArchived}>
          <i className="icon icon-archive-from-main" /><span>Go to archive</span>
          <span className="shortcuts">
            <span className="kbd">⌘</span>
            <span className="kbd">9</span>
          </span>
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

const CommandMenu: FC<CommandMenuProps> = ({
  topUserIds, usersById, recentlyFoundChatIds, folders,
}) => {
  const { track } = useJune();
  const {
    showNotification, openUrl, openChatByUsername,
  } = getActions();
  const [isOpen, setOpen] = useState(false);
  const [isArchiverEnabled, setIsArchiverEnabled] = useState(
    !!JSON.parse(String(localStorage.getItem('ulu_is_autoarchiver_enabled'))),
  );
  const { archiveMessages } = useArchiver({ isManual: true });
  const [inputValue, setInputValue] = useState('');
  const [menuItems, setMenuItems] = useState<Array<{ label: string; value: string }>>([]);
  const { runCommand } = useCommands();
  const [pages, setPages] = useState(['home']);
  const activePage = pages[pages.length - 1];
  // eslint-disable-next-line no-null/no-null
  const folderId = activePage.includes('folderPage:') ? activePage.split(':')[1] : null;
  const [isAutomationSettingsOpen, setAutomationSettingsOpen] = useState(false);

  const openAutomationSettings = () => setAutomationSettingsOpen(true);
  const closeAutomationSettings = () => setAutomationSettingsOpen(false);

  const close = useCallback(() => {
    setOpen(false);
    setPages(['home']);
    setInputValue('');
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

      if (!menuItems.some((item) => item.label === newLabel)) {
        setMenuItems((prevItems) => [...prevItems, newItem]);
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

  const openFolderPage = useCallback((id) => { // Замена folderId на id
    setPages([...pages, `folderPage:${id}`]);
  }, [pages]);

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

  const handleOpenAutomationSettings = () => {
    console.log('Handle open Automation Settings called');
    close();
    openAutomationSettings();
  };

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

  const handleLockScreenHotkey = useCallback(() => {
    runCommand('LOCK_SCREEN');
    close();
  }, [runCommand, close]);

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

  const getFolderName = (id: number | null) => {
    // eslint-disable-next-line no-null/no-null
    if (id === null) return 'Unknown Folder';

    const global = getGlobal() as GlobalState;
    const folder = global.chatFolders.byId[id];
    return folder ? folder.title : `Folder ${id}`;
  };

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
    <div>
      <Command.Dialog
        label="Command Menu"
        open={isOpen}
        onOpenChange={setOpen}
        loop
        shouldFilter
        filter={customFilter}
      >
        {pages.map((page) => {
        // Показываем бейдж только если страница не 'home'
          if (page !== 'home') {
            return (
              <div key={page} cmdk-vercel-badge="">
                {page.startsWith('folderPage') ? `Folder: ${getFolderName(Number(folderId))}` : page}
              </div>
            );
          }
          // eslint-disable-next-line no-null/no-null
          return null; // Ничего не рендерим для 'home'
        })}
        <Command.Input
          placeholder="Type a command or search..."
          autoFocus
          onValueChange={handleInputChange}
          value={inputValue}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && inputValue === '') {
              handleBack();
            }
          }}
        />
        <Command.List>
          <>
            {activePage === 'home' && (
              <>
                <HomePage
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
                  handleLockScreenHotkey={handleLockScreenHotkey}
                  commandToggleArchiver={commandToggleArchiver}
                  recentlyFoundChatIds={recentlyFoundChatIds}
                  handleOpenAutomationSettings={handleOpenAutomationSettings}
                />
                <AllUsersAndChats
                  close={close}
                  searchQuery={inputValue}
                  topUserIds={topUserIds}
                  folders={folders}
                  openFolderPage={openFolderPage}
                  setInputValue={setInputValue}
                />
              </>
            )}
            {activePage === 'createNew' && (
              <CreateNewPage
                handleSelectNewGroup={handleSelectNewGroup}
                handleSelectNewChannel={handleSelectNewChannel}
                handleCreateFolder={handleCreateFolder}
              />
            )}
            {activePage.includes('folderPage') && folderId && (
              <FolderPage
                folderId={Number(folderId)}
                close={close}
              />
            )}
          </>
        </Command.List>
        <Command.Empty />
        <button className="global-search" onClick={handleSearchFocus}>
          <i className="icon icon-search" />
          <span>
            <span>No results found</span>
            <span className="user-handle">Go to advanced search</span>
          </span>
          <span className="shortcuts">
            <span className="kbd">⌘</span>
            <span className="kbd">/</span>
          </span>
        </button>
      </Command.Dialog>
      {isAutomationSettingsOpen && (
        <AutomationSettings
          isOpen={isAutomationSettingsOpen}
          onClose={closeAutomationSettings}
        />
      )}
    </div>

  );

  cmdkRoot.render(CommandMenuInner);
  return <div />;
};

export default memo(withGlobal(
  (global): CommandMenuProps => {
    const { userIds: topUserIds } = global.topPeers;
    const usersById = global.users.byId;
    const chatsById = global.chats.byId;
    const chatFoldersById = global.chatFolders.byId;
    const orderedFolderIds = global.chatFolders.orderedIds;
    const recentlyFoundChatIds = global.recentlyFoundChatIds;
    const folders = orderedFolderIds
      ? orderedFolderIds.map((folderId) => chatFoldersById[folderId]).filter(Boolean)
      : [];

    return {
      topUserIds, usersById, chatsById, folders, recentlyFoundChatIds,
    };
  },
)(CommandMenu));
