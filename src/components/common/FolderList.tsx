/* eslint-disable react/jsx-no-bind */
import React from 'react';
import { Command } from 'cmdk';
import type { FC } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiChatFolder } from '../../api/types';
import type { GlobalState } from '../../global/types';

/* import renderText from './helpers/renderText'; */

type StateProps = {
  chatFoldersById: Record<number, ApiChatFolder>;
  orderedFolderIds?: number[];
};

/* const renderFolderName = (title: string) => {
  const renderedTitle = renderText(title);
  const content = React.isValidElement(renderedTitle) ? renderedTitle : <span>{title}</span>;

  return {
    content,
    value: title,
  };
}; */

type OwnProps = {
  onSelectFolder: (folderId: number) => void;
};
const FolderList: FC<OwnProps & StateProps> = ({ chatFoldersById, orderedFolderIds, onSelectFolder }) => {
  const folders = orderedFolderIds?.map((id) => chatFoldersById[id]) || [];

  return (
    <>
      {folders.map((folder) => (
        <Command.Item key={folder.id} onSelect={() => onSelectFolder(folder.id)}>
          {`Folder ${folder.id}`}
        </Command.Item>
      ))}
    </>
  );
};

const FolderListConnected = withGlobal<OwnProps>(
  (global: GlobalState): StateProps => {
    const {
      chatFolders: {
        byId: chatFoldersById,
        orderedIds: orderedFolderIds = [],
      },
    } = global;

    return {
      chatFoldersById,
      orderedFolderIds,
    };
  },
)(FolderList);

export default FolderListConnected;
