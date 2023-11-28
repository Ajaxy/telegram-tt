/* eslint-disable react/jsx-no-bind */
/* eslint-disable import/no-cycle */
import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import captureEscKeyListener from '../../util/captureEscKeyListener';

import { useJune } from '../../hooks/useJune';
import useKeywordFolderRule from '../../hooks/useKeywordFolderRule';

import RuleCard from './RuleCard';

import './AutomationSettings.scss';

interface AutomationSettingsProps {
  isOpen: boolean;
  onClose: () => void; // тип для функции, которая ничего не возвращает
}

type Rule = {
  keyword: string;
  folderId: number;
};

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
  const [isDuplicateError, setIsDuplicateError] = useState(false);
  const { track } = useJune();

  // Функция для проверки на дубликаты
  const checkForDuplicates = useCallback((currentKeyword: string, currentFolderId: number) => {
    return rules.some((rule) => rule.keyword === currentKeyword && rule.folderId === currentFolderId);
  }, [rules]);

  // eslint-disable-next-line no-null/no-null
  const selectRef = useRef<HTMLSelectElement>(null);

  const handleFolderSelectorClick = () => {
    if (selectRef.current) {
      selectRef.current.focus();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKeyword = e.target.value;
    setKeyword(newKeyword);
    // Обновление проверки дубликата
    if (newKeyword.trim() && selectedFolderId) {
      setIsDuplicateError(checkForDuplicates(newKeyword, selectedFolderId));
    } else {
      setIsDuplicateError(false);
    }
  };

  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null); // Создаем ref для инпута

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setIsActive(true);
    }
  }, [isOpen]);

  // Функция для закрытия окна, вызывает пропс onClose
  const close = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
  // Если окно видимо, подписываемся на событие нажатия клавиши Esc
    return isOpen ? captureEscKeyListener(close) : undefined;
  }, [close, isOpen]);

  const handleSelectFolder = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const newFolderId = Number(event.target.value);
    setSelectedFolderId(newFolderId);
    // Обновление проверки дубликата
    if (keyword && keyword.trim() && newFolderId) {
      setIsDuplicateError(checkForDuplicates(keyword, newFolderId));
    } else {
      setIsDuplicateError(false);
    }
  }, [keyword, checkForDuplicates]);

  useEffect(() => {
    setCanSave(selectedFolderId !== undefined && selectedFolderId !== 0 && keyword.trim() !== '');
  }, [selectedFolderId, keyword]);

  const [unsavedChanges, setUnsavedChanges] = useState(false);

  const handleRuleUpdate = (index: number, updatedRule: Rule) => {
    const updatedRules = [...rules];
    updatedRules[index] = updatedRule;
    setRules(updatedRules);
    setUnsavedChanges(true); // Установка флага несохраненных изменений
  };

  const handleSave = useCallback(() => {
    if (unsavedChanges) {
      setUnsavedChanges(false);
      showNotification({ message: 'Changes saved' });
    } else if (selectedFolderId && keyword.trim() && !isDuplicateError) {
      addRule(keyword, selectedFolderId);
      showNotification({ message: 'Rule added' });
      setKeyword('');
      setSelectedFolderId(undefined);
      setIsDuplicateError(false);
      if (track) {
        track('Create folder automation rule');
      }
    } else {
      //
    }
  }, [unsavedChanges, selectedFolderId, keyword, isDuplicateError, addRule, setKeyword, track]);

  const handleRemove = useCallback((ruleIndex: number) => {
    const updatedRules = rules.filter((_, index) => index !== ruleIndex);
    setRules(updatedRules);
    showNotification({ message: 'Rule removed' });
  }, [rules, setRules, showNotification]);

  useEffect(() => {
    setIsDuplicateError(checkForDuplicates(keyword, selectedFolderId || 0));
  }, [keyword, selectedFolderId, checkForDuplicates, rules]);

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
        <span className="back-button-settins">
          <div className="icon-wrapper">
            <i className="icon icon-arrow-left" onClick={close} />
          </div>
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
                onUpdate={handleRuleUpdate}
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
                  <div className="folder-selector" onClick={handleFolderSelectorClick}>
                    <i className={`icon icon-folder ${selectedFolderId ? 'active' : ''}`} />
                    <select
                      ref={selectRef}
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
                {isDuplicateError && (
                  <div className="error-duplicate">This rule already exists</div>
                )}
              </div>
            </div>
          </div>
          <button
            className={`saveButton ${canSave ? 'active' : ''}`}
            disabled={!canSave}
            onClick={canSave ? handleSave : undefined}
          >
            <span
              className={`saveButtonText ${canSave ? 'active' : ''}`}
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
