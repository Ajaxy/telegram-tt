/* eslint-disable no-console */
/* eslint-disable react/no-array-index-key */
/* eslint-disable react/jsx-no-bind */
import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { Command } from 'cmdk';
import type { FC } from '../../../../lib/teact/teact';
import { useCallback, useEffect } from '../../../../lib/teact/teact';

import { cmdKey, DEFAULT_WORKSPACE } from '../../../../config';
import { IS_APP } from '../../../../util/windowEnvironment';

import useCommands from '../../../../hooks/useCommands';

import CommandMenuListItem from '../CommanMenuListItem';

import '../../../main/CommandMenu.scss';

export type Workspace = {
  id: string;
  name: string;
  logoUrl?: string;
};

interface NavigationGroupProps {
  allWorkspaces: Workspace[];
  currentWorkspace: Workspace;
  openAutomationSettings: () => void;
  handleSelectWorkspace: (workspaceId: string) => void;
  close: () => void;
}

const NavigationGroup: FC<NavigationGroupProps> = ({
  handleSelectWorkspace, close, allWorkspaces, openAutomationSettings, currentWorkspace,
}) => {
  const { runCommand, useCommand } = useCommands();

  const handleSelectSettings = useCallback(() => {
    runCommand('OPEN_SETTINGS');
    close();
  }, [runCommand, close]);

  const handleSearchFocus = useCallback(() => {
    runCommand('OPEN_SEARCH');
    close();
  }, [runCommand, close]);

  const handleOpenSavedMessages = useCallback(() => {
    runCommand('OPEN_SAVED');
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

  const handleLockScreenHotkey = useCallback(() => {
    runCommand('LOCK_SCREEN');
    close();
  }, [runCommand, close]);

  const handleOpenAutomationSettings = () => {
    close();
    openAutomationSettings();
  };

  useCommand('OPEN_AUTOMATION_SETTINGS', handleOpenAutomationSettings);

  const renderWorkspaceIcon = (workspace: Workspace) => {
    if (workspace.logoUrl) {
      return <img className="image" src={workspace.logoUrl} alt={`${workspace.name} logo`} />;
    } else if (workspace.id !== DEFAULT_WORKSPACE.id) {
      return <div className="placeholder">{workspace.name[0].toUpperCase()}</div>;
    } else if (workspace.id === DEFAULT_WORKSPACE.id) {
      return <div className="placeholder">P</div>;
    } // Placeholder для персонал воркспейса
    return undefined;
  };

  const menuItems = [
    ...allWorkspaces
      .filter((workspace) => workspace.id !== currentWorkspace.id)
      .map((workspace) => ({
        onSelect: () => handleSelectWorkspace(workspace.id),
        content: (
          <>
            {renderWorkspaceIcon(workspace)}
            <span>Go to {workspace.name} workspace</span>
          </>
        ),
      })),
    {
      onSelect: handleSearchFocus,
      label: 'Find chat or contact',
      icon: 'search',
      shortcut: [cmdKey, '/'],
    },
    IS_APP && {
      onSelect: handleLockScreenHotkey,
      label: 'Lock Screen',
      icon: 'lock',
      shortcut: [cmdKey, 'L'],
    },
    {
      onSelect: handleOpenInbox,
      label: 'Go to inbox',
      icon: 'arrow-right',
      shortcut: [cmdKey, 'I'],
    },
    {
      onSelect: handleOpenSavedMessages,
      label: 'Go to saved messages',
      icon: 'arrow-right',
      shortcut: [cmdKey, '0'],
    },
    {
      onSelect: handleSelectArchived,
      label: 'Go to archive',
      icon: 'arrow-right',
      shortcut: [cmdKey, '9'],
    },
    {
      onSelect: handleSelectSettings,
      label: 'Go to settings',
      icon: 'arrow-right',
      shortcut: [cmdKey, ','],
    },
    {
      onSelect: handleOpenAutomationSettings,
      label: 'Go to folder-automations',
      icon: 'arrow-right',
    },
  ].filter(Boolean);

  return (
    <Command.Group heading="Navigation">
      {menuItems.map((item, index) => (
        <CommandMenuListItem
          key={index}
          onSelect={item.onSelect}
          content={item.content}
          icon={item.icon}
          label={item.label}
          shortcut={item.shortcut}
        />
      ))}
    </Command.Group>
  );
};

export default NavigationGroup;
