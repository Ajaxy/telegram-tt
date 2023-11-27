/* eslint-disable import/no-cycle */
import React from 'react';
import { useState } from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import './AutomationSettings.scss';

type Rule = {
  keyword: string;
  folderId: number;
};

interface RuleCardProps {
  rule: Rule;
  index: number;
  onUpdate: (index: number, updatedRule: Rule) => void;
  onRemove: (index: number) => void;
}

// Компонент для отображения правил
const RuleCard: React.FC<RuleCardProps> = ({
  rule, index, onUpdate, onRemove,
}) => {
  const global = getGlobal();

  const orderedFolderIds = global.chatFolders.orderedIds;
  const chatFoldersById = global.chatFolders.byId;
  const folders = orderedFolderIds ? orderedFolderIds.map((id) => chatFoldersById[id]).filter(Boolean) : [];
  const [isActive, setIsActive] = useState(false);

  const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(index, { ...rule, keyword: e.target.value });
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdate(index, { ...rule, folderId: Number(e.target.value) });
  };

  const isFolderSelected = rule.folderId > 0;

  return (
    <div className="ruleCard">
      <div className="ruleCardContent">
        <div className="ruleBlockKeyword">
          <div className="ruleBlockText">
            If a group name contains
          </div>
          <input
            type="text"
            className={`keywordInput ${isActive ? 'active' : ''}`}
            value={rule.keyword}
            onChange={handleKeywordChange}
            onFocus={() => setIsActive(true)}
            onBlur={() => setIsActive(false)}
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
            <i className={`icon icon-folder ${isFolderSelected ? 'active' : ''}`} />
            <select
              className={`folderSelect ${isFolderSelected ? 'active' : ''}`}
              value={rule.folderId}
              onChange={handleFolderChange}
            >
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
