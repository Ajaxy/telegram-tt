/* eslint-disable no-console */
/* eslint-disable react/no-array-index-key */
/* eslint-disable react/jsx-no-bind */
import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { Command } from 'cmdk';
import type { FC } from '../../../../lib/teact/teact';
import { useCallback, useEffect } from '../../../../lib/teact/teact';
import { getActions } from '../../../../lib/teact/teactn';

import { cmdKey } from '../../../../config';
import { IS_ARC_BROWSER } from '../../../../util/windowEnvironment';

import useCommands from '../../../../hooks/useCommands';

import CommandMenuListItem from '../CommanMenuListItem';

import '../../../main/CommandMenu.scss';

interface CreateNewGroupProps {
  close: () => void;
  handleOpenWorkspaceSettings: () => void;
}

const CreateNewGroup: FC<CreateNewGroupProps> = ({
  close, handleOpenWorkspaceSettings,
}) => {
  const { runCommand } = useCommands();
  const {
    openUrl,
  } = getActions();

  const handleSelectNewChannel = useCallback(() => {
    runCommand('NEW_CHANNEL');
    close();
  }, [runCommand, close]);

  const handleSelectNewGroup = useCallback(() => {
    runCommand('NEW_GROUP');
    close();
  }, [runCommand, close]);

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

  const handleCreateFolder = useCallback(() => {
    runCommand('NEW_FOLDER');
    close();
  }, [runCommand, close]);

  const handleOpenAutomationSettings = () => {
    close();
    runCommand('OPEN_AUTOMATION_SETTINGS');
  };

  const handleNewMeetLink = () => {
    close();
    openUrl({
      url: 'https://meet.new',
      shouldSkipModal: true,
    });
  };

  const handleNewLinearTask = useCallback(() => {
    close();
    openUrl({
      url: 'https://linear.app/new',
      shouldSkipModal: true,
    });
  }, [close]);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyT') {
        handleNewLinearTask();
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [handleNewLinearTask]);

  const menuItems = [
    {
      onSelect: handleSelectNewGroup,
      icon: 'group',
      label: 'Create new group',
      shortcut: IS_ARC_BROWSER ? [cmdKey, 'G'] : [cmdKey, '⇧', 'C'],
    },
    {
      onSelect: handleNewMeetLink,
      icon: 'video-outlined',
      label: 'Create new Google Meet',
    },
    {
      onSelect: handleNewLinearTask,
      icon: 'linear',
      label: 'Create new Linear task',
      shortcut: [cmdKey, '⇧', 'L'],
    },
    {
      onSelect: handleSelectNewChannel,
      icon: 'channel',
      label: 'Create new channel',
    },
    {
      onSelect: handleCreateFolder,
      icon: 'folder',
      label: 'Create new folder',
    },
    {
      onSelect: handleOpenWorkspaceSettings,
      icon: 'forums',
      label: 'Create workspace',
    },
    {
      onSelect: handleOpenAutomationSettings,
      icon: 'bots',
      label: 'Create folder rule',
    },
  ];

  return (
    <Command.Group heading="Create new...">
      {menuItems.map((item, index) => (
        <CommandMenuListItem
          key={index}
          onSelect={item.onSelect}
          icon={item.icon}
          label={item.label}
          shortcut={item.shortcut}
        />
      ))}
    </Command.Group>
  );
};

export default CreateNewGroup;
