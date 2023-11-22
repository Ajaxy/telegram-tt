/* eslint-disable import/no-cycle */
/* eslint-disable no-console */
import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import useKeywordFolderRule from '../../hooks/useKeywordFolderRule';

import RuleCard from './RuleCard';

import './AutomationSettings.scss';

interface AutomationSettingsProps {
  isOpen: boolean;
  onClose: () => void; // тип для функции, которая ничего не возвращает
}

const cmdkElement = document.getElementById('automation-settings-root');
const cmdkRoot = createRoot(cmdkElement!);

const AutomationSettings: React.FC<AutomationSettingsProps> = ({ isOpen, onClose }) => {
  const global = getGlobal();
  const { showNotification } = getActions();
  const {
    rules, setRules, keyword, setKeyword, addRule,
  } = useKeywordFolderRule();
  const [selectedFolderId, setSelectedFolderId] = useState<number | undefined>();

  const orderedFolderIds = global.chatFolders.orderedIds;
  const chatFoldersById = global.chatFolders.byId;
  const folders = orderedFolderIds ? orderedFolderIds.map((id) => chatFoldersById[id]).filter(Boolean) : [];
  const [isActive, setIsActive] = useState(false);
  const [canSave, setCanSave] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setKeyword(e.target.value);
    console.log('Input Changed:', e.target.value); // Лог изменения значения
  };

  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null); // Создаем ref для инпута

  useEffect(() => {
    console.log('AutomationSettings isOpen:', isOpen);
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Функция для закрытия окна, вызывает пропс onClose
  const close = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleSelectFolder = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const folderId = Number(event.target.value);
    setSelectedFolderId(folderId);
  }, []);

  useEffect(() => {
    setCanSave(selectedFolderId !== undefined && selectedFolderId !== 0 && keyword.trim() !== '');
  }, [selectedFolderId, keyword]);

  const handleSave = useCallback(() => {
    if (selectedFolderId !== undefined && keyword.trim() !== '') {
      console.log('Сохранение правила. Keyword:', keyword, 'Folder ID:', selectedFolderId);
      showNotification({ message: 'Rules was updated' });
      addRule(keyword, selectedFolderId);
    } else {
      console.log('Ошибка сохранения: Keyword пуст или Folder ID не выбран');
    }
  }, [keyword, selectedFolderId, addRule]);

  const handleRemove = useCallback((index: number) => {
    const updatedRules = rules.filter((_, ruleIndex) => ruleIndex !== index);
    setRules(updatedRules);
    showNotification({ message: 'Rule removed' });
  }, [rules, setRules, showNotification]);

  useEffect(() => {
    setCanSave(selectedFolderId !== undefined && selectedFolderId !== 0 && keyword.trim() !== '');
  }, [selectedFolderId, keyword]);

  const AutemationSettingInner = (
    <div>
      <div
        className="fullScreenKeywordCreator "
        onClick={(e) => {
          const nativeEvent = e.nativeEvent as Event;
          nativeEvent.stopImmediatePropagation();
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <span className="back-button">
          <i className="icon icon-arrow-left" onClick={close} />
          <div className="closeButton" onClick={close}>Back to app</div>
        </span>
        <div className="keywordCreator">
          <div className="keywordCreatorHeader">
            <div>Automation</div>
          </div>
          <div className="keywordCreatorDesc">
            <div>Add a rule for automatic group addition in the folder and workspace.</div>
          </div>
          <div className="rulesContainer">
            {/* Отображение существующих правил */}
            {rules.map((rule, index) => (
              <RuleCard
                key={`rule-${rule.keyword}-${rule.folderId}`}
                rule={rule}
                index={index}
                onRemove={handleRemove}
              />
            ))}
            <div className="ruleCard">
              <div className="ruleCardContent">
                <div className="ruleBlockKeyword">
                  <div className="ruleBlockText">
                    If a group name contains
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    className={`keywordInput ${isActive ? 'active' : ''}`}
                    value={keyword}
                    onChange={handleInputChange}
                    onFocus={() => setIsActive(true)}
                    onBlur={() => setIsActive(false)}
                    placeholder="Enter keyword"
                  />
                  <div className="icon-wrapper">
                    <i className="icon icon-delete" />
                  </div>
                </div>
                <div className="ruleBlockFolder">
                  <div className="ruleBlockText">
                    then add it to the folder
                  </div>
                  <div className="folderSelector">
                    <i className={`icon icon-folder ${selectedFolderId ? 'active' : ''}`} />
                    <select
                      value={selectedFolderId}
                      onChange={handleSelectFolder}
                      className={`folderSelect ${selectedFolderId ? 'active' : ''}`}
                    >
                      <option value="">Select folder</option>
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
          </div>
          <button className={`saveButton ${canSave ? 'active' : ''}`} disabled={!canSave}>
            <span
              className={`saveButtonText ${canSave ? 'active' : 'inactive'}`}
              onClick={canSave ? handleSave : undefined}
            >
              Save
            </span>
          </button>
        </div>
      </div>
    </div>
  );

  cmdkRoot.render(isOpen ? AutemationSettingInner : <div />);
  return <div />;
};

export default AutomationSettings;
