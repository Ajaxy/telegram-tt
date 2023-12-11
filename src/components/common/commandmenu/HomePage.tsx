/* eslint-disable react/no-array-index-key */
/* eslint-disable react/jsx-no-bind */
import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { Command } from 'cmdk';

import type { ApiUser } from '../../../api/types';

import useLang from '../../../hooks/useLang';

import CreateNewGroup from './HomePage/CreateNewGroup';
import HelpGroup from './HomePage/HelpGroup';
import NavigationGroup from './HomePage/NavigationGroup';
import SuggestedContacts from './HomePage/SuggestedContactsGroup';

import '../../main/CommandMenu.scss';

export type Workspace = {
  id: string;
  name: string;
  logoUrl?: string;
};

interface HomePageProps {
  isArchiveWhenDoneEnabled: boolean;
  isAutoDoneEnabled: boolean;
  isFoldersTreeEnabled: boolean;
  topUserIds?: string[];
  usersById: Record<string, ApiUser>;
  recentlyFoundChatIds?: string[];
  menuItems: Array<{ label: string; value: string }>;
  currentWorkspace: Workspace;
  allWorkspaces: Workspace[];
  currentChatId?: string;
  inputValue: string;
  isCurrentChatDone?: boolean;
  isChatUnread?: boolean;
  saveAPIKey: () => void;
  commandDoneAll: () => void;
  handleDoneChat: () => void;
  commandArchiveAll: () => void;
  commandToggleAutoDone: () => void;
  commandToggleArchiveWhenDone: () => void;
  commandToggleFoldersTree: () => void;
  handleToggleChatUnread: () => void;
  handleOpenAutomationSettings: () => void;
  handleOpenWorkspaceSettings: () => void;
  handleSelectWorkspace: (workspaceId: string) => void;
  openChangeThemePage: () => void;
  handleChangelog: () => void;
  close: () => void;
}

const HomePage: React.FC<HomePageProps> = ({
  commandDoneAll, commandToggleAutoDone, isAutoDoneEnabled, commandToggleFoldersTree,
  commandArchiveAll, commandToggleArchiveWhenDone, isArchiveWhenDoneEnabled,
  topUserIds, usersById, recentlyFoundChatIds, close, isFoldersTreeEnabled, openChangeThemePage,
  menuItems, inputValue, saveAPIKey,
  handleChangelog,
  handleOpenAutomationSettings, allWorkspaces,
  handleOpenWorkspaceSettings, handleSelectWorkspace, currentWorkspace,
  currentChatId, isCurrentChatDone, handleDoneChat, handleToggleChatUnread, isChatUnread,
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
      {inputValue === '' && topUserIds && usersById && (
        <SuggestedContacts
          topUserIds={topUserIds}
          usersById={usersById}
          recentlyFoundChatIds={recentlyFoundChatIds}
          close={close}
        />
      )}
      <CreateNewGroup
        close={close}
        handleOpenWorkspaceSettings={handleOpenWorkspaceSettings}
      />
      <NavigationGroup
        allWorkspaces={allWorkspaces}
        handleSelectWorkspace={handleSelectWorkspace}
        currentWorkspace={currentWorkspace}
        openAutomationSettings={handleOpenAutomationSettings}
        close={close}
      />
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
      <HelpGroup
        close={close}
      />
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
