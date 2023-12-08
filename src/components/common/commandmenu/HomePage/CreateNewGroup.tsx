/* eslint-disable no-console */
/* eslint-disable react/no-array-index-key */
/* eslint-disable react/jsx-no-bind */
import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { Command } from 'cmdk';
import type { FC } from '../../../../lib/teact/teact';
import { useCallback } from '../../../../lib/teact/teact';

import { IS_ARC_BROWSER } from '../../../../util/windowEnvironment';

import useCommands from '../../../../hooks/useCommands';

import '../../../main/CommandMenu.scss';

interface CreateNewGroupProps {
  close: () => void;
  handleOpenWorkspaceSettings: () => void;
}

const CreateNewGroup: FC<CreateNewGroupProps> = ({
  close, handleOpenWorkspaceSettings,
}) => {
  const { runCommand } = useCommands();

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

  const handleOpenAutomationSettings = () => {
    close();
    runCommand('OPEN_AUTOMATION_SETTINGS');
  };

  return (
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
  );
};

export default CreateNewGroup;
