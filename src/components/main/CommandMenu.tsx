/* eslint-disable no-console */
/* eslint-disable react/no-array-index-key */
/* eslint-disable react/jsx-no-bind */
import React from 'react';
import { createRoot } from 'react-dom/client';
// eslint-disable-next-line react/no-deprecated
import { Command } from 'cmdk';
import type { FC } from '../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useRef,
  useState,
} from '../../lib/teact/teact';
import { getGlobal } from '../../lib/teact/teactn';
import { getActions, withGlobal } from '../../global';

import type { ApiChat, ApiChatFolder, ApiUser } from '../../api/types';
import type { GlobalState } from '../../global/types';

import { FAQ_URL, SHORTCUTS_URL } from '../../config';
import {
  getChatTitle, getUserFullName,
} from '../../global/helpers';
import { selectCurrentChat, selectTabState, selectUser } from '../../global/selectors';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { convertLayout } from '../../util/convertLayout';
import { transliterate } from '../../util/transliterate';
import { IS_ARC_BROWSER } from '../../util/windowEnvironment';

import useArchiver from '../../hooks/useArchiver';
import useCommands from '../../hooks/useCommands';
import useDone from '../../hooks/useDone';
import { useJune } from '../../hooks/useJune';
import useLang from '../../hooks/useLang';
import { useStorage } from '../../hooks/useStorage';

import ChangeThemePage from '../common/ChangeThemePage';
import CreateNewPage from '../common/commandmenu/CreateNewPage';
import HomePage from '../common/commandmenu/HomePage';
import FolderPage from '../common/FolderPage';
import CommanMenuChatSearch from '../left/search/CommanMenuChatSearch';
import AutomationSettings from './AutomationSettings';
// eslint-disable-next-line import/no-named-as-default
import WorkspaceSettings from './WorkspaceSettings';

import './CommandMenu.scss';

const cmdkElement = document.getElementById('cmdk-root');
const cmdkRoot = createRoot(cmdkElement!);

export type Workspace = {
  id: string;
  name: string;
  logoUrl?: string;
};

interface CommandMenuProps {
  topUserIds?: string[];
  currentUser: ApiUser | undefined;
  currentChat?: ApiChat;
  currentChatId?: string;
  localContactIds?: string[];
  localChatIds?: string[];
  localUserIds?: string[];
  globalChatIds?: string[];
  globalUserIds?: string[];
  usersById: Record<string, ApiUser>;
  pinnedIds?: string[];
  activeListIds?: string[];
  archivedListIds?: string[];
  contactIds?: string[];
  folders: ApiChatFolder[];
  chatsById?: Record<string, ApiChat>;
  recentlyFoundChatIds?: string[];
  currentWorkspace: Workspace;
  savedWorkspaces: Workspace[];
  fetchingStatus?: { chats?: boolean; messages?: boolean };
  handleSelectWorkspace: (workspaceId: string, closeFunc: () => void) => void;
}

const customFilter = (value: string, search: string) => {
  const convertedSearch = convertLayout(search);
  const transliteratedSearch = transliterate(search).toLowerCase();
  if (value.toLowerCase().includes(search.toLowerCase())
      || value.toLowerCase().includes(convertedSearch.toLowerCase())
      || value.toLowerCase().includes(transliteratedSearch.toLowerCase())) {
    return 1; // полное соответствие
  }
  return 0; // нет соответствия
};

const CommandMenu: FC<CommandMenuProps> = ({
  topUserIds,
  currentUser,
  currentChat,
  currentChatId,
  usersById,
  chatsById,
  pinnedIds,
  recentlyFoundChatIds,
  folders, handleSelectWorkspace: originalHandleSelectWorkspace, savedWorkspaces, currentWorkspace,
}) => {
  const { track, analytics } = useJune();
  const {
    showNotification, openUrl, openChatByUsername, toggleChatUnread,
  } = getActions();
  const [isOpen, setOpen] = useState(false);
  const {
    isAutoDoneEnabled, setIsAutoDoneEnabled,
    isArchiveWhenDoneEnabled, setIsArchiveWhenDoneEnabled,
    isFoldersTreeEnabled, setIsFoldersTreeEnabled,
  } = useStorage();
  const { archiveChats } = useArchiver({ isManual: true });
  const { doneAllReadChats, doneChat, isChatDone } = useDone();
  const [inputValue, setInputValue] = useState('');
  const [menuItems, setMenuItems] = useState<Array<{ label: string; value: string }>>([]);
  const { runCommand } = useCommands();
  const [pages, setPages] = useState(['home']);
  const activePage = pages[pages.length - 1];
  // eslint-disable-next-line no-null/no-null
  const folderId = activePage.includes('folderPage:') ? activePage.split(':')[1] : null;
  const [isAutomationSettingsOpen, setAutomationSettingsOpen] = useState(false);
  const [isWorkspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);
  const isChatUnread = currentChat && ((currentChat.unreadCount ?? 0) > 0 || currentChat.hasUnreadMark);
  const isCurrentChatDone = currentChat && isChatDone(currentChat);
  const allWorkspaces = [
    ...savedWorkspaces,
    ...(currentWorkspace.id !== 'personal' ? [{ id: 'personal', name: 'Personal', logoUrl: undefined }] : []),
  ];

  // eslint-disable-next-line no-null/no-null
  const commandListRef = useRef<HTMLDivElement>(null);
  const [prevInputValue, setPrevInputValue] = useState('');

  const openAutomationSettings = useCallback(() => {
    setAutomationSettingsOpen(true);
  }, []);
  const closeAutomationSettings = useCallback(() => {
    setAutomationSettingsOpen(false);
  }, []);

  const openWorkspaceSettings = useCallback((workspaceId?: string) => {
    // eslint-disable-next-line no-console
    console.log(workspaceId || '');
    setWorkspaceSettingsOpen(true);
  }, []);

  const closeWorkspaceSettings = useCallback(() => {
    setWorkspaceSettingsOpen(false);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setPages(['home']);
    setInputValue('');
  }, []);

  const lang = useLang();

  // Toggle the menu when ⌘K is pressed
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      // Получаем текущее выделение
      const selection = window.getSelection();

      // Проверяем, есть ли выделенный текст
      const hasSelection = selection && selection.toString() !== '';

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.code === 'KeyK' && !hasSelection) {
        setOpen(!isOpen);
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [isOpen]);

  const handleSelectWorkspace = (workspaceId: string) => {
    originalHandleSelectWorkspace(workspaceId, close); // передаем функцию close
    if (track) { track('Switch workspace', { source: 'Сommand Menu' }); }
  };

  const handleInputChange = (newValue: string) => {
    setPrevInputValue(inputValue);
    setInputValue(newValue);
  };

  useEffect(() => {
    // Проверяем, уменьшилась ли длина строки
    if (inputValue.length < prevInputValue.length && commandListRef.current) {
      commandListRef.current.scrollTop = 0; // Прокрутка наверх
    }
  }, [inputValue, prevInputValue]);

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

  const openChangeThemePage = useCallback(() => {
    console.log('Opening changeTheme page');
    setPages(['changeTheme']); // Заменяем массив pages только текущей страницей
  }, []);

  const saveAPIKey = useCallback(() => {
    localStorage.setItem('openai_api_key', inputValue);
    showNotification({ message: 'The OpenAI API key has been saved.' });
    setOpen(false);
    if (track) {
      track('Add openAI key');
    }
  }, [inputValue, track]);

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

  const { useCommand } = useCommands();

  const handleOpenAutomationSettings = () => {
    close();
    openAutomationSettings();
  };

  useCommand('OPEN_AUTOMATION_SETTINGS', handleOpenAutomationSettings);

  const handleOpenWorkspaceSettings = useCallback((workspaceId?: string) => {
    close();
    if (workspaceId) {
      // Логика для редактирования воркспейса
      openWorkspaceSettings(workspaceId);
    } else {
      // Логика для создания нового воркспейса
      openWorkspaceSettings();
    }
  }, [close, openWorkspaceSettings]);

  const [receivedWorkspaceId, setReceivedWorkspaceId] = useState<string | undefined>();

  const renderWorkspaceIcon = (workspace: Workspace) => {
    if (workspace.logoUrl) {
      return <img className="image" src={workspace.logoUrl} alt={`${workspace.name} logo`} />;
    } else if (workspace.id !== 'personal') {
      return <div className="placeholder">{workspace.name[0].toUpperCase()}</div>;
    } else if (workspace.id === 'personal') {
      return <div className="placeholder">P</div>;
    } // Placeholder для персонал воркспейса
    return undefined;
  };

  useCommand('OPEN_WORKSPACE_SETTINGS', (workspaceId) => {
    setReceivedWorkspaceId(workspaceId);
    openWorkspaceSettings(workspaceId);
  // Откройте WorkspaceSettings здесь или установите состояние, которое приведет к его открытию
  });

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

  const commandToggleArchiveWhenDone = useCallback(() => {
    const updIsArchiveWhenDoneEnabled = !isArchiveWhenDoneEnabled;
    showNotification({
      message: updIsArchiveWhenDoneEnabled
        ? 'Enabled "Аrchive chats when mark as done"'
        : 'Disabled "Аrchive chats when mark as done"',
    });
    setIsArchiveWhenDoneEnabled(updIsArchiveWhenDoneEnabled);
    close();
    if (analytics && currentUser) {
      analytics.identify(currentUser.id, {
        autoArchiveWhenDone: updIsArchiveWhenDoneEnabled,
      });
    }
  }, [analytics, close, currentUser, isArchiveWhenDoneEnabled, setIsArchiveWhenDoneEnabled]);

  const commandToggleAutoDone = useCallback(() => {
    const updIsAutoDoneEnabled = !isAutoDoneEnabled;
    showNotification({ message: updIsAutoDoneEnabled ? 'Auto-Done enabled!' : 'Auto-Done disabled!' });
    setIsAutoDoneEnabled(updIsAutoDoneEnabled);

    if (analytics && currentUser) {
      analytics.identify(currentUser.id, {
        autoDoneAfterRead: updIsAutoDoneEnabled,
      });
    }
    close();
  }, [analytics, close, currentUser, isAutoDoneEnabled, setIsAutoDoneEnabled]);

  const commandToggleFoldersTree = useCallback(() => {
    const updIsFoldersTreeEnabled = !isFoldersTreeEnabled;
    showNotification({
      message: updIsFoldersTreeEnabled
        ? 'Folders Tree (Beta) enabled!'
        : 'Telegram Default Folders enabled!',
    });
    setIsFoldersTreeEnabled(updIsFoldersTreeEnabled);
    close();
    window.location.reload();
    if (track) {
      track(updIsFoldersTreeEnabled ? 'Turn on new Folder view' : 'Turn off new Folder view');
    }
  }, [close, isFoldersTreeEnabled, setIsFoldersTreeEnabled, track]);

  const commandDoneAll = useCallback(() => {
    showNotification({ message: 'All read chats are marked as done!' });
    doneAllReadChats();
    close();
    if (track) {
      track('Use "Mark all read chats as done" command');
    }
  }, [close, doneAllReadChats, track]);

  // Функция для отметки чата как непрочитанного/прочитанного
  const handleToggleChatUnread = useCallback(() => {
    if (currentChatId && currentChat) {
      toggleChatUnread({ id: currentChatId });
      const action = isChatUnread ? 'MarkedAsRead' : 'MarkedAsUnread';
      showNotification({ message: lang(action) });
      close();
      if (track) {
        track(isChatUnread ? 'Mark as Read' : 'Mark as Unread', { source: 'Сommand Menu' });
      }
    }
  }, [currentChatId, currentChat, isChatUnread, lang, close, track]);

  // Функция для отметки чата как выполненного
  const handleDoneChat = useCallback(() => {
    if (currentChatId) {
      doneChat({ id: currentChatId });
      close();
      if (track) {
        track('Mark as Done', { source: 'Сommand Menu' });
      }
    }
  }, [currentChatId, doneChat, close, track]);

  const commandArchiveAll = useCallback(() => {
    showNotification({ message: 'All older than 24 hours will be archived!' });
    archiveChats();
    close();
    if (track) {
      track('Use "Archive all read chats" command');
    }
  }, [close, archiveChats, track]);

  const getFolderName = (id: number | null) => {
    // eslint-disable-next-line no-null/no-null
    if (id === null) return 'Unknown Folder';

    const global = getGlobal() as GlobalState;
    const folder = global.chatFolders.byId[id];
    return folder ? folder.title : `Folder ${id}`;
  };

  useEffect(() => {
    console.log('Current pages:', pages);
  }, [pages]);

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

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      // Получаем текущее выделение
      const selection = window.getSelection();

      // Проверяем, есть ли выделенный текст
      const hasSelection = selection && selection.toString() !== '';

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.code === 'KeyI' && !hasSelection) {
        handleOpenInbox();
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [handleOpenInbox]);

  // Функция для получения названия чата
  const getCurrentChatName = () => {
    if (!currentChatId) return undefined;

    // Проверка на существование usersById и chatsById перед их использованием
    if (usersById && usersById[currentChatId]) {
      return getUserFullName(usersById[currentChatId]);
    }

    if (chatsById && chatsById[currentChatId]) {
      return getChatTitle(lang, chatsById[currentChatId]);
    }

    return undefined;
  };

  const currentChatName = getCurrentChatName();

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
          if (page !== 'home' && page !== 'changeTheme') {
            return (
              <div key={page} cmdk-vercel-badge="">
                {page.startsWith('folderPage') ? `Folder: ${getFolderName(Number(folderId))}` : page}
              </div>
            );
          }
          // Отображение бейджа с названием текущего чата на главной странице
          return currentChatId && (
            <div key="chat-badge" cmdk-vercel-badge="">
              {`Chat: ${currentChatName}`}
            </div>
          );
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
        <Command.List ref={commandListRef}>
          <>
            {activePage === 'home' && (
              <>
                <HomePage
                  commandDoneAll={commandDoneAll}
                  commandArchiveAll={commandArchiveAll}
                  commandToggleAutoDone={commandToggleAutoDone}
                  commandToggleArchiveWhenDone={commandToggleArchiveWhenDone}
                  commandToggleFoldersTree={commandToggleFoldersTree}
                  isAutoDoneEnabled={isAutoDoneEnabled}
                  isArchiveWhenDoneEnabled={isArchiveWhenDoneEnabled}
                  isFoldersTreeEnabled={isFoldersTreeEnabled}
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
                  recentlyFoundChatIds={recentlyFoundChatIds}
                  handleOpenAutomationSettings={handleOpenAutomationSettings}
                  handleOpenWorkspaceSettings={handleOpenWorkspaceSettings}
                  handleSelectWorkspace={handleSelectWorkspace}
                  currentWorkspace={currentWorkspace}
                  renderWorkspaceIcon={renderWorkspaceIcon}
                  currentChatId={currentChatId}
                  handleToggleChatUnread={handleToggleChatUnread}
                  handleDoneChat={handleDoneChat}
                  isChatUnread={isChatUnread}
                  isCurrentChatDone={isCurrentChatDone}
                  allWorkspaces={allWorkspaces}
                  openChangeThemePage={openChangeThemePage}
                  inputValue={inputValue}
                />
                <CommanMenuChatSearch
                  close={close}
                  searchQuery={inputValue}
                  folders={folders}
                  openFolderPage={openFolderPage}
                  setInputValue={setInputValue}
                  recentlyFoundChatIds={recentlyFoundChatIds}
                  topUserIds={topUserIds}
                  pinnedIds={pinnedIds}
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
            {activePage === 'changeTheme' && (
              <ChangeThemePage
                close={close}
                setInputValue={setInputValue}
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
      <AutomationSettings
        isOpen={isAutomationSettingsOpen}
        onClose={closeAutomationSettings}
      />
      <WorkspaceSettings
        isOpen={isWorkspaceSettingsOpen}
        onClose={closeWorkspaceSettings}
        workspaceId={receivedWorkspaceId}
      />
    </div>

  );

  cmdkRoot.render(CommandMenuInner);
  return <div />;
};

export default memo(withGlobal(
  (global): CommandMenuProps => {
    const { userIds: topUserIds } = global.topPeers;
    const currentUser = global.currentUserId ? selectUser(global, global.currentUserId) : undefined;
    const { userIds: localContactIds } = global.contactList || {};
    const currentChat = selectCurrentChat(global);
    const currentChatId = selectCurrentChat(global)?.id;
    const usersById = global.users.byId;
    const chatsById = global.chats.byId;
    const pinnedIds = global.chats.orderedPinnedIds.active;
    const chatFoldersById = global.chatFolders.byId;
    const orderedFolderIds = global.chatFolders.orderedIds;
    const recentlyFoundChatIds = global.recentlyFoundChatIds;
    const folders = orderedFolderIds
      ? orderedFolderIds.map((folderId) => chatFoldersById[folderId]).filter(Boolean)
      : [];
    const {
      fetchingStatus, globalResults, localResults,
    } = selectTabState(global).globalSearch;
    const { chatIds: globalChatIds, userIds: globalUserIds } = globalResults || {};
    const { chatIds: localChatIds, userIds: localUserIds } = localResults || {};

    // Получение информации о воркспейсах из localStorage
    const currentWorkspaceId = localStorage.getItem('currentWorkspace');
    const savedWorkspacesString = localStorage.getItem('workspaces') || '[]';
    const savedWorkspaces = JSON.parse(savedWorkspacesString) as Workspace[];

    let currentWorkspace = savedWorkspaces.find((ws) => ws.id === currentWorkspaceId);
    if (!currentWorkspace) {
      currentWorkspace = { id: 'personal', name: 'Personal Workspace', logoUrl: undefined };
    }

    const saveCurrentWorkspaceToLocalStorage = (workspaceId: string) => {
      localStorage.setItem('currentWorkspace', workspaceId);
    };

    const handleSelectWorkspace = (workspaceId: string, closeFunc: () => void) => {
      saveCurrentWorkspaceToLocalStorage(workspaceId);
      closeFunc(); // вызов close
    };

    return {
      topUserIds,
      currentUser,
      currentChat,
      currentChatId,
      localContactIds,
      localChatIds,
      localUserIds,
      globalChatIds,
      globalUserIds,
      chatsById,
      pinnedIds,
      fetchingStatus,
      usersById,
      folders,
      recentlyFoundChatIds,
      currentWorkspace,
      savedWorkspaces,
      handleSelectWorkspace,
    };
  },
)(CommandMenu));
