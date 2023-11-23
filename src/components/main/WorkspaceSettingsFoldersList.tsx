import React, { useState } from 'react';

import './FolderSelector.scss';

interface Folder {
  id: number;
  title: string;
}

interface FolderSelectorProps {
  folders: Folder[];
}

const FolderSelector: React.FC<FolderSelectorProps> = ({ folders }) => {
  const [selectedFolders, setSelectedFolders] = useState<Set<number>>(new Set());

  const toggleFolder = (id: number) => {
    setSelectedFolders((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return newSelected;
    });
  };

  return (
    <div className="folderSelector">
      {folders.map((folder) => (
        <div key={folder.id} className="folderItem" onClick={() => toggleFolder(folder.id)}>
          <div className="icon-wrapper">
            <i className="icon icon-folder folderIcon" />
          </div>
          <span className="folderTitle">{folder.title}</span>
          <div className={selectedFolders.has(folder.id) ? 'selectedCheckmark' : 'unselectedCheckmark'}>
            <i className="icon icon-check" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default FolderSelector;
