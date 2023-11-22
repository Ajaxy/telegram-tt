/* eslint-disable import/no-cycle */
/* eslint-disable no-console */
import React from 'react';
import { getGlobal } from '../../global';

import './AutomationSettings.scss';

type Rule = {
  keyword: string;
  folderId: number;
};

interface RuleCardProps {
  rule: Rule;
  index: number;
  onRemove: (index: number) => void;
}

// Компонент для отображения правил
const RuleCard: React.FC<RuleCardProps> = ({
  rule, index, onRemove,
}) => {
  const global = getGlobal();

  const orderedFolderIds = global.chatFolders.orderedIds;
  const chatFoldersById = global.chatFolders.byId;
  const folders = orderedFolderIds ? orderedFolderIds.map((id) => chatFoldersById[id]).filter(Boolean) : [];

  return (
    <div className="ruleCard">
      <div className="ruleCardContent">
        <div className="ruleBlockKeyword">
          <div className="ruleBlockText">
            If a group name contains
          </div>
          <input
            type="text"
            className="keywordInput"
            value={rule.keyword}
            readOnly
          />
          <div className="icon-wrapper" onClick={() => onRemove(index)}>
            <i className="icon icon-delete" />
          </div>
        </div>
        <div className="ruleBlockFolder">
          <div className="ruleBlockText">
            then add it to the folder
          </div>
          <div className="folderSelector">
            <i className="icon icon-folder" />
            <select className="folderSelect" value={rule.folderId} disabled>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RuleCard;
