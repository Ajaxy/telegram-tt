/* eslint-disable react/jsx-no-bind */
import type { ChangeEvent } from 'react';
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { UploadManager } from '@bytescale/sdk';
import {
  useCallback, useEffect,
} from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import { DEFAULT_WORKSPACE } from '../../config';
import captureEscKeyListener from '../../util/captureEscKeyListener';

import { useJune } from '../../hooks/useJune';

// eslint-disable-next-line import/no-named-as-default
import FolderSelector from './WorkspaceSettingsFoldersList';

import './WorkspaceSettings.scss';

interface WorkspaceSettingsProps {
  isOpen: boolean;
  onClose: () => void; // тип для функции, которая ничего не возвращает
  workspaceId?: string;
}

const cmdkElement = document.getElementById('workspace-settings-root');
const cmdkRoot = createRoot(cmdkElement!);

const WorkspaceSettings: React.FC<WorkspaceSettingsProps> = ({ isOpen, onClose, workspaceId }) => {
  const global = getGlobal();
  const chatFoldersById = global.chatFolders.byId;
  const orderedFolderIds = global.chatFolders.orderedIds;
  const folders = orderedFolderIds ? orderedFolderIds.map((id) => chatFoldersById[id]).filter(Boolean) : [];
  const [isInitialized, setIsInitialized] = useState(false); // Новое состояние для отслеживания инициализации
  const [workspaceName, setWorkspaceName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  // eslint-disable-next-line no-null/no-null
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const { track } = useJune();

  const uploadManager = new UploadManager({
    apiKey: 'public_kW15bndTdL4cidRTCc1sS8rNYQsu',
  });
  const [mode, setMode] = useState<'create' | 'edit'>('create'); // Новая переменная состояния для режима
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const {
    showNotification,
  } = getActions();

  const resetState = useCallback(() => {
    setWorkspaceName('');
    setLogoUrl('');
    setSelectedFolderIds([]);
    setIsCreating(false);
    setSelectedFile(undefined);
  }, []);

  useEffect(() => {
    if (workspaceId) {
      if (!isInitialized) {
        const savedWorkspaces = JSON.parse(localStorage.getItem('workspaces') || '[]');
        const currentWorkspace = savedWorkspaces.find((ws: { id: string }) => ws.id === workspaceId);
        if (currentWorkspace) {
          setWorkspaceName(currentWorkspace.name);
          setLogoUrl(currentWorkspace.logoUrl);
          setSelectedFolderIds(currentWorkspace.folders.map(Number));
        }
        setIsInitialized(true);
      }
    } else if (isInitialized) {
      resetState();
      setIsInitialized(false);
    }
  }, [workspaceId, isInitialized, resetState]);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const tempUrl = URL.createObjectURL(file);
    setLogoUrl(tempUrl);
    setHasChanges(true); // Устанавливаем временный URL для предпросмотра
  };

  const close = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const handleWorkspaceAction = async () => {
    setIsCreating(true);
    try {
      const newWorkspaceId = workspaceId || Date.now().toString();
      let finalLogoUrl = logoUrl;
      if (selectedFile) {
        const newFileName = `${workspaceName}_${newWorkspaceId}.${selectedFile.type.split('/')[1]}`;
        const fileWithNewName = new File([selectedFile], newFileName, { type: selectedFile.type });
        const { fileUrl } = await uploadManager.upload({ data: fileWithNewName });

        finalLogoUrl = `${fileUrl.replace('/raw/', '/image/')}?w=128&h=128`;
        setLogoUrl(finalLogoUrl); // Обновляем URL после загрузки на сервер
        URL.revokeObjectURL(logoUrl); // Освобождаем временный URL
        setHasChanges(false);
      }

      const newWorkspaceData = {
        id: newWorkspaceId,
        name: workspaceName,
        logoUrl: finalLogoUrl,
        folders: selectedFolderIds,
      };

      const savedWorkspaces = JSON.parse(localStorage.getItem('workspaces') || '[]');
      if (workspaceId) {
        // Обновляем существующий воркспейс
        setMode('edit');
        const updatedWorkspaces = savedWorkspaces.map((ws: {
          id: string;
        }) => (ws.id === workspaceId ? newWorkspaceData : ws));
        localStorage.setItem('workspaces', JSON.stringify(updatedWorkspaces));
        close();
        showNotification({ message: 'Workspace updated successfully.' });
      } else {
        // Создаем новый воркспейс
        setMode('create');
        resetState();
        localStorage.setItem('workspaces', JSON.stringify([...savedWorkspaces, newWorkspaceData]));
        localStorage.setItem('currentWorkspace', newWorkspaceData.id); // Устанавливаем новый воркспейс как текущий
        close();
        showNotification({ message: 'Workspace created successfully.' }); // Уведомление о создании
        track?.('Create new workspace');
      }
    } catch (error) {
      //
    } finally {
      setIsCreating(false);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setWorkspaceName(e.target.value);
    setHasChanges(true);
  };

  const handleSelectedFoldersChange = (selectedIds: number[]) => {
    setSelectedFolderIds(selectedIds);
    setHasChanges(true);
  };

  useEffect(() => {
    return () => {
      if (!isOpen && mode === 'create') {
        resetState();
        setIsInitialized(false);
      }
    };
  }, [isOpen, mode, resetState]);

  useEffect(() => {
    // Если окно видимо, подписываемся на событие нажатия клавиши Esc
    return isOpen ? captureEscKeyListener(close) : undefined;
  }, [close, isOpen]);

  const handleDeleteWorkspace = () => {
    const savedWorkspaces = JSON.parse(localStorage.getItem('workspaces') || '[]');
    const updatedWorkspaces = savedWorkspaces.filter((ws: {
      id: string;
    }) => ws.id !== workspaceId);
    localStorage.setItem('workspaces', JSON.stringify(updatedWorkspaces));
    localStorage.setItem('currentWorkspace', DEFAULT_WORKSPACE.id); // Устанавливаем активный воркспейс на "Personal"
    showNotification({ message: 'Workspace deleted successfully.' });
    close(); // Закрываем модальное окно
  };
  const isSaveButtonActive = workspaceName && selectedFolderIds.length > 0 && hasChanges;
  const WorkspaceSettingsInner = (
    <div
      className="background"
    >
      <span className="back-button-settins">
        <div className="icon-wrapper">
          <i className="icon icon-arrow-left" onClick={close} />
        </div>
      </span>
      <div className="workspaceCreator">
        <div className="workspaceInput">
          {/* Скрытый input для загрузки файлов */}
          <input
            className="fileInput"
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
          />
          {/* Кнопка для активации input */}
          {logoUrl ? (
            <div className="uploadedImageContainer">
              <img src={logoUrl} alt="Uploaded Logo" />
            </div>
          ) : (
            <div className="uploadButton" onClick={triggerFileSelect}>
              <div className="icon-wrapper">
                <i className="icon icon-add" />
              </div>
            </div>
          )}
          <div className="inputText">
            <input
              className="inputText"
              type="text"
              value={workspaceName}
              onChange={handleInputChange}
              placeholder="Workspace name"
            />
          </div>
          <div className="characterCount">
            {`${workspaceName.length}/40`}
          </div>
        </div>
        <div className="desc">
          <div>The recommended logo size is 256x256px.</div>
        </div>
        <div className="header">
          <div>Folders</div>
        </div>
        <FolderSelector
          folders={folders}
          selectedFolderIds={selectedFolderIds}
          onSelectedFoldersChange={handleSelectedFoldersChange}
        />
        <button
          className={`saveButton ${isSaveButtonActive ? 'active' : ''}`}
          onClick={handleWorkspaceAction}
          disabled={!workspaceName || selectedFolderIds.length === 0}
        >
          <span className={`saveButtonText ${isSaveButtonActive ? 'active' : ''}`}>
            {isCreating ? 'Saving...' : (workspaceId ? 'Update workspace' : 'Create workspace')}
          </span>
        </button>
        {workspaceId && (
          <button
            className="deleteButton"
            onClick={handleDeleteWorkspace}
          >
            <span className="deleteButtonText">
              Delete workspace
            </span>
          </button>
        )}
      </div>
    </div>
  );

  cmdkRoot.render(isOpen ? WorkspaceSettingsInner : <div />);
  return <div />;
};

export default WorkspaceSettings;
