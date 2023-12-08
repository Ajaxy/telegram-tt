/* eslint-disable no-console */
/* eslint-disable react/no-array-index-key */
/* eslint-disable react/jsx-no-bind */
import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { Command } from 'cmdk';
import type { FC } from '../../../../lib/teact/teact';
import { useCallback, useEffect } from '../../../../lib/teact/teact';

import { IS_APP } from '../../../../util/windowEnvironment';

import useCommands from '../../../../hooks/useCommands';

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
    } else if (workspace.id !== 'personal') {
      return <div className="placeholder">{workspace.name[0].toUpperCase()}</div>;
    } else if (workspace.id === 'personal') {
      return <div className="placeholder">P</div>;
    } // Placeholder для персонал воркспейса
    return undefined;
  };

  return (
    <Command.Group heading="Navigation">
      {allWorkspaces.map((workspace) => {
        if (workspace.id !== currentWorkspace.id) {
          return (
            <Command.Item
              key={workspace.id}
              onSelect={() => {
                handleSelectWorkspace(workspace.id);
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
  );
};

export default NavigationGroup;
