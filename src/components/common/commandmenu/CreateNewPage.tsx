/* eslint-disable no-console */
/* eslint-disable react/no-array-index-key */
/* eslint-disable react/jsx-no-bind */
import React from 'react';
// eslint-disable-next-line react/no-deprecated
import { Command } from 'cmdk';

import { IS_ARC_BROWSER } from '../../../util/windowEnvironment';

import '../../main/CommandMenu.scss';

export type Workspace = {
  id: string;
  name: string;
  logoUrl?: string;
};

interface CreateNewPageProps {
  handleSelectNewGroup: () => void;
  handleSelectNewChannel: () => void;
  handleCreateFolder: () => void;
}

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

export default CreateNewPage;
