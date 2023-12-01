/* eslint-disable no-console */
/* eslint-disable react/no-array-index-key */
/* eslint-disable react/jsx-no-bind */
import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { Command } from 'cmdk';

import type { ApiUser } from '../../../api/types';

import { IS_APP, IS_ARC_BROWSER } from '../../../util/windowEnvironment';

import useLang from '../../../hooks/useLang';

import SuggestedContacts from './SuggestedContacts';

import '../../main/CommandMenu.scss';

export type Workspace = {
  id: string;
  name: string;
  logoUrl?: string;
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
  currentWorkspace: Workspace;
  allWorkspaces: Workspace[];
  renderWorkspaceIcon: (workspace: Workspace) => JSX.Element | undefined;
  currentChatId?: string;
  handleToggleChatUnread: () => void;
  handleDoneChat: () => void;
  isChatUnread?: boolean;
  isCurrentChatDone?: boolean;
  showNotification: (params: { message: string }) => void;
  openChangeThemePage: () => void;
}

const HomePage: React.FC<HomePageProps> = ({
  commandDoneAll, commandToggleAutoDone, isAutoDoneEnabled, commandToggleFoldersTree,
  commandArchiveAll, commandToggleArchiveWhenDone, isArchiveWhenDoneEnabled,
  topUserIds, usersById, recentlyFoundChatIds, close, isFoldersTreeEnabled, openChangeThemePage,
  handleSearchFocus, handleOpenSavedMessages, handleSelectSettings,
  handleSelectArchived, handleOpenInbox, menuItems, saveAPIKey,
  handleSupport, handleFAQ, handleChangelog, handleSelectNewGroup, handleCreateFolder, handleSelectNewChannel,
  handleOpenShortcuts, handleLockScreenHotkey, handleOpenAutomationSettings, allWorkspaces,
  handleOpenWorkspaceSettings, handleSelectWorkspace, currentWorkspace, renderWorkspaceIcon,
  currentChatId, handleToggleChatUnread, handleDoneChat, isChatUnread, isCurrentChatDone, showNotification,
}) => {
  const lang = useLang();
  return (
    <>
      {
        currentChatId && (
          <Command.Group>
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
            <Command.Item onSelect={handleToggleChatUnread}>
              <i className={`icon ${isChatUnread ? 'icon-unread' : 'icon-readchats'}`} />
              <span>{lang(isChatUnread ? 'MarkAsRead' : 'MarkAsUnread')}</span>
              <span className="shortcuts">
                <span className="kbd">⌘</span>
                <span className="kbd">U</span>
              </span>
            </Command.Item>
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
        {allWorkspaces.map((workspace) => {
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
        <Command.Item onSelect={openChangeThemePage}>
          <i className="icon icon-darkmode" /><span>Change interface theme</span>
        </Command.Item>
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

export default HomePage;
