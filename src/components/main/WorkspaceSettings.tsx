/* eslint-disable no-console */
/* eslint-disable react/jsx-no-bind */
import type { ChangeEvent } from 'react';
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { UploadManager } from '@bytescale/sdk';
import {
  useCallback, useEffect,
} from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import captureEscKeyListener from '../../util/captureEscKeyListener';

import FolderSelector from './WorkspaceSettingsFoldersList';

import './WorkspaceSettings.scss';

interface WorkspaceSettingsProps {
  isOpen: boolean;
  onClose: () => void; // тип для функции, которая ничего не возвращает
}

const cmdkElement = document.getElementById('workspace-settings-root');
const cmdkRoot = createRoot(cmdkElement!);

const WorkspaceSettings: React.FC<WorkspaceSettingsProps> = ({ isOpen, onClose }) => {
  const global = getGlobal();
  const chatFoldersById = global.chatFolders.byId;
  const orderedFolderIds = global.chatFolders.orderedIds;
  const folders = orderedFolderIds ? orderedFolderIds.map((id) => chatFoldersById[id]).filter(Boolean) : [];

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

  const [workspaceName, setWorkspaceName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  // eslint-disable-next-line no-null/no-null
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadManager = new UploadManager({
    apiKey: 'public_kW15bndTdL4cidRTCc1sS8rNYQsu',
  });

  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setLogoUrl(URL.createObjectURL(file)); // Создаем временный URL для предпросмотра
  };

  const createWorkspace = async () => {
    setIsCreating(true);
    try {
      let finalLogoUrl = logoUrl;
      if (selectedFile) {
        const { fileUrl } = await uploadManager.upload({ data: selectedFile });
        // Преобразование URL для обработки изображения
        finalLogoUrl = `${fileUrl.replace('/raw/', '/image/')}?w=128&h=128`;
        setLogoUrl(finalLogoUrl); // Сохраняем URL после загрузки на сервер
        URL.revokeObjectURL(logoUrl); // Освобождаем временный URL
      }
      // Сохраняем данные воркспейса в localStorage
      localStorage.setItem('workspace', JSON.stringify(
        {
          name: workspaceName, logoUrl: finalLogoUrl, folders: selectedFolderIds,
        },
      ));
    } catch (error) {
      console.error('Upload error:', error);
    }
    setIsCreating(false);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setWorkspaceName(e.target.value);
  };

  const handleSelectedFoldersChange = (selectedIds: number[]) => {
    setSelectedFolderIds(selectedIds);
  };

  const WorkspaceSettingsInner = (
    <div
      className="background"
    >
      <span className="back-button">
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
          <div>Name your workspace in such a way that it&apos;s easy to remember and understand.</div>
        </div>
        <div className="header">
          <div>Folders</div>
        </div>
        <FolderSelector
          folders={folders}
          onSelectedFoldersChange={handleSelectedFoldersChange}
        />
        <button
          className="saveButton"
          onClick={createWorkspace}
          disabled={!workspaceName || selectedFolderIds.length === 0}
        >
          <span
            className="saveButtonText"
          >
            {isCreating ? 'Creating...' : 'Create workspace'}
          </span>
        </button>
      </div>
    </div>
  );

  cmdkRoot.render(isOpen ? WorkspaceSettingsInner : <div />);
  return <div />;
};

export default WorkspaceSettings;
