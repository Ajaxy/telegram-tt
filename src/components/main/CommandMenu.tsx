/* eslint-disable react/no-array-index-key */
/* eslint-disable react/jsx-no-bind */
import React from 'react';
import { createRoot } from 'react-dom/client';
// eslint-disable-next-line react/no-deprecated
import { Command } from 'cmdk';
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
import { selectCurrentChat, selectUser } from '../../global/selectors';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { convertLayout } from '../../util/convertLayout';
import { throttle } from '../../util/schedulers';
import { IS_APP, IS_ARC_BROWSER } from '../../util/windowEnvironment';
import renderText from '../common/helpers/renderText';

import useArchiver from '../../hooks/useArchiver';
import useCommands from '../../hooks/useCommands';
import useDone from '../../hooks/useDone';
import { useJune } from '../../hooks/useJune';
import useLang from '../../hooks/useLang';
import { useStorage } from '../../hooks/useStorage';

import AllUsersAndChats from '../common/AllUsersAndChats';
import FolderPage from '../common/FolderPage';
import AutomationSettings from './AutomationSettings';
// eslint-disable-next-line import/no-named-as-default
import WorkspaceSettings from './WorkspaceSettings';

import './CommandMenu.scss';

const cmdkElement = document.getElementById('cmdk-root');
const cmdkRoot = createRoot(cmdkElement!);
const SEARCH_CLOSE_TIMEOUT_MS = 250;

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
  usersById: Record<string, ApiUser>;
  folders: ApiChatFolder[];
  chatsById?: Record<string, ApiChat>;
  recentlyFoundChatIds?: string[];
  currentWorkspace: Workspace;
  savedWorkspaces: Workspace[];
  handleSelectWorkspace: (workspaceId: string, closeFunc: () => void) => void;
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
  const { track } = useJune();
  const handleClick = useCallback((id: string) => {
    openChat({ id, shouldReplaceHistory: true });
    setTimeout(() => addRecentlyFoundChatId({ id }), SEARCH_CLOSE_TIMEOUT_MS);
    close();
    if (track) {
      track('Use suggestions in Сommand Menu', { chatId: id });
    }
  }, [close, track]);

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
  commandDoneAll: () => void;
  commandArchiveAll: () => void;
  commandToggleAutoDone: () => void;
  commandToggleArchiveWhenDone: () => void;
  commandToggleFoldersTree: () => void;
  isArchiveWhenDoneEnabled: boolean;
  isAutoDoneEnabled: boolean;
  isFoldersTreeEnabled: boolean;
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
  handleOpenAutomationSettings: () => void;
  handleOpenWorkspaceSettings: () => void;
  handleSelectWorkspace: (workspaceId: string) => void;
  savedWorkspaces: Workspace[];
  currentWorkspace: Workspace;
  renderWorkspaceIcon: (workspace: Workspace) => JSX.Element | undefined;
  currentChatId?: string;
  handleToggleChatUnread: () => void;
  handleDoneChat: () => void;
  isChatUnread?: boolean;
  isCurrentChatDone?: boolean;
  showNotification: (params: { message: string }) => void;
}

interface CreateNewPageProps {
  handleSelectNewGroup: () => void;
  handleSelectNewChannel: () => void;
  handleCreateFolder: () => void;
}

const HomePage: React.FC<HomePageProps> = ({
  commandDoneAll, commandToggleAutoDone, isAutoDoneEnabled, commandToggleFoldersTree,
  commandArchiveAll, commandToggleArchiveWhenDone, isArchiveWhenDoneEnabled,
  topUserIds, usersById, recentlyFoundChatIds, close, isFoldersTreeEnabled,
  handleSearchFocus, handleOpenSavedMessages, handleSelectSettings,
  handleSelectArchived, handleOpenInbox, menuItems, saveAPIKey,
  handleSupport, handleFAQ, handleChangelog, handleSelectNewGroup, handleCreateFolder, handleSelectNewChannel,
  handleOpenShortcuts, handleLockScreenHotkey, handleOpenAutomationSettings,
  handleOpenWorkspaceSettings, handleSelectWorkspace, savedWorkspaces, currentWorkspace, renderWorkspaceIcon,
  currentChatId, handleToggleChatUnread, handleDoneChat, isChatUnread, isCurrentChatDone, showNotification,
}) => {
  const lang = useLang();
  return (
    <>
      {
        currentChatId && (
          <Command.Group>
            <Command.Item onSelect={handleToggleChatUnread}>
              <i className={`icon ${isChatUnread ? 'icon-unread' : 'icon-readchats'}`} />
              <span>{lang(isChatUnread ? 'MarkAsRead' : 'MarkAsUnread')}</span>
              <span className="shortcuts">
                <span className="kbd">⌘</span>
                <span className="kbd">U</span>
              </span>
            </Command.Item>
            {
              !isCurrentChatDone && (
                <Command.Item onSelect={handleDoneChat}>
                  <i className="icon icon-select" /><span>Mark as Done</span>
                  <span className="shortcuts">
                    <span className="kbd">⌘</span>
                    <span className="kbd">E</span>
                  </span>
                </Command.Item>
              )
            }
          </Command.Group>
        )
      }
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
        <Command.Item onSelect={() => handleOpenWorkspaceSettings()}>
          <i className="icon icon-forums" /><span>Create workspace</span>
        </Command.Item>
        <Command.Item onSelect={handleOpenAutomationSettings}>
          <i className="icon icon-bots" /><span>Create folder rule</span>
        </Command.Item>
      </Command.Group>
      <Command.Group heading="Navigation">
        {savedWorkspaces.map((workspace) => {
          if (workspace.id !== currentWorkspace.id) {
            return (
              <Command.Item
                key={workspace.id}
                onSelect={() => {
                  handleSelectWorkspace(workspace.id);
                  showNotification({ message: 'Workspace is changing...' });
                }}
              >
                {renderWorkspaceIcon(workspace)}
                <span>Go to {workspace.name} workspace</span>
              </Command.Item>
            );
          }
          return undefined;
        })}
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
          <i className="icon icon-arrow-right" /><span>Go to inbox</span>
          <span className="shortcuts">
            <span className="kbd">⌘</span>
            <span className="kbd">I</span>
          </span>
        </Command.Item>
        <Command.Item onSelect={handleOpenSavedMessages}>
          <i className="icon icon-arrow-right" /><span>Go to saved messages</span>
          <span className="shortcuts">
            <span className="kbd">⌘</span>
            <span className="kbd">0</span>
          </span>
        </Command.Item>
        <Command.Item onSelect={handleSelectArchived}>
          <i className="icon icon-arrow-right" /><span>Go to archive</span>
          <span className="shortcuts">
            <span className="kbd">⌘</span>
            <span className="kbd">9</span>
          </span>
        </Command.Item>
        <Command.Item onSelect={handleSelectSettings}>
          <i className="icon icon-arrow-right" /><span>Go to settings</span>
          <span className="shortcuts">
            <span className="kbd">⌘</span>
            <span className="kbd">,</span>
          </span>
        </Command.Item>
        <Command.Item onSelect={handleOpenAutomationSettings}>
          <i className="icon icon-arrow-right" /><span>Go to folder-automations</span>
        </Command.Item>
      </Command.Group>
      <Command.Group heading="What's new">
        <Command.Item onSelect={handleChangelog}>
          <i className="icon icon-calendar" /><span>Changelog</span>
        </Command.Item>
        <Command.Item onSelect={commandToggleFoldersTree}>
          <i className="icon icon-folder" />
          <span>
            {isFoldersTreeEnabled
              ? 'Switch back to the Telegram folders UI'
              : 'Enable the new folders UI (Beta)'}
          </span>
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
          <i className="icon icon-ask-support" /><span>Send feedback</span>
        </Command.Item>
        <Command.Item onSelect={handleSupport}>
          <i className="icon icon-animations" /><span>Request feature</span>
        </Command.Item>
        <Command.Item onSelect={handleSupport}>
          <i className="icon icon-bug" /><span>Report bug</span>
        </Command.Item>
        <Command.Item onSelect={handleSupport}>
          <i className="icon icon-help" /><span>Contact support</span>
        </Command.Item>
      </Command.Group>
      <Command.Group heading="Settings">
        <Command.Item onSelect={commandDoneAll}>
          <i className="icon icon-readchats" /><span>Mark All Read Chats as Done</span>
        </Command.Item>
        <Command.Item onSelect={commandArchiveAll}>
          <i className="icon icon-archive-from-main" /><span>Archive All Read Chats (May take ~1-3 min)</span>
        </Command.Item>
        <Command.Item onSelect={commandToggleAutoDone}>
          <i className="icon icon-select" />
          <span>
            {isAutoDoneEnabled
              ? 'Disable Auto-Done for Read Chats'
              : 'Enable Auto-Done for Read Chats'}
          </span>
        </Command.Item>
        <Command.Item onSelect={commandToggleArchiveWhenDone}>
          <i className="icon icon-archive" />
          <span>
            {isArchiveWhenDoneEnabled
              ? 'Disable "Аrchive chats when mark as done"'
              : 'Enable "Аrchive chats when mark as done"'}
          </span>
        </Command.Item>
        {menuItems.map((item, index) => (
          <Command.Item key={index} onSelect={item.value === 'save_api_key' ? saveAPIKey : undefined}>
            {item.label}
          </Command.Item>
        ))}
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
  topUserIds,
  currentUser,
  currentChat,
  currentChatId,
  usersById,
  chatsById,
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

  const openAutomationSettings = useCallback(() => {
    setAutomationSettingsOpen(true);
  }, []);
  const closeAutomationSettings = useCallback(() => {
    setAutomationSettingsOpen(false);
  }, []);

  const openWorkspaceSettings = useCallback((workspaceId?: string) => {
    // eslint-disable-next-line no-console
    console.log('Opening workspace settings for:', workspaceId || '');
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
    }
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
      showNotification({ message: 'Chat marked as done' });
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

  // Использование функции для получения названия чата
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
          if (page !== 'home') {
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
        <Command.List>
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
                  savedWorkspaces={savedWorkspaces}
                  currentWorkspace={currentWorkspace}
                  renderWorkspaceIcon={renderWorkspaceIcon}
                  currentChatId={currentChatId}
                  handleToggleChatUnread={handleToggleChatUnread}
                  handleDoneChat={handleDoneChat}
                  isChatUnread={isChatUnread}
                  isCurrentChatDone={isCurrentChatDone}
                  showNotification={showNotification}
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
    const currentChat = selectCurrentChat(global);
    const currentChatId = selectCurrentChat(global)?.id;
    const usersById = global.users.byId;
    const chatsById = global.chats.byId;
    const chatFoldersById = global.chatFolders.byId;
    const orderedFolderIds = global.chatFolders.orderedIds;
    const recentlyFoundChatIds = global.recentlyFoundChatIds;
    const folders = orderedFolderIds
      ? orderedFolderIds.map((folderId) => chatFoldersById[folderId]).filter(Boolean)
      : [];

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
      usersById,
      chatsById,
      folders,
      recentlyFoundChatIds,
      currentWorkspace,
      savedWorkspaces,
      handleSelectWorkspace,
    };
  },
)(CommandMenu));
