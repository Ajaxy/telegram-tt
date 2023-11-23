import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

import useCommands from '../../../hooks/useCommands';

import './SettingsDropdown.scss';

interface Workspace {
  id: string;
  name: string;
}

const personalWorkspace = {
  id: 'personal',
  name: 'Personal Workspace',
};

interface WorkspaceDropdownProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onClose: () => void;
}

const cmdkElement = document.getElementById('workspace-dropdown-root');
const cmdkRoot = createRoot(cmdkElement!);

const WorkspaceDropdown: React.FC<WorkspaceDropdownProps> = ({ isOpen, setIsOpen, onClose }) => {
  const savedWorkspaces = localStorage.getItem('workspaces');
  const workspaces: Workspace[] = savedWorkspaces ? JSON.parse(savedWorkspaces) : [];
  const allWorkspaces = [personalWorkspace, ...workspaces];
  const { runCommand } = useCommands();
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLElement>(null); // Обновляем тип ref

  const handleOpenWorkspaceSettings = (workspaceId?: string) => {
    // Если workspaceId передан, значит открывается редактирование воркспейса
    // Если workspaceId не передан, значит создается новый воркспейс
    if (workspaceId) {
      runCommand('OPEN_WORKSPACE_SETTINGS', workspaceId);
    } else {
      runCommand('OPEN_WORKSPACE_SETTINGS');
    }
  };

  useEffect(() => {
    if (!isOpen) {
      onClose(); // Вызывается при изменении состояния на false
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    // Указываем тип для event
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false); // Изменяем состояние на false
      }
    };

    // Добавляем обработчик события
    document.addEventListener('mousedown', handleClickOutside);

    // Очищаем обработчик при размонтировании компонента
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [setIsOpen]);

  const handleOpenAutomationSettings = () => {
    runCommand('OPEN_AUTOMATION_SETTINGS');
  };

  const onSelectSettings = () => {
    runCommand('OPEN_SETTINGS');
  };

  const getCurrentWorkspaceFromLocalStorage = () => {
    return localStorage.getItem('currentWorkspace') || 'personal';
  };

  const saveCurrentWorkspaceToLocalStorage = (workspaceId: string) => {
    localStorage.setItem('currentWorkspace', workspaceId);
  };

  const handleSelectWorkspace = (workspaceId: string) => {
    // TODO: Реализуйте функционал выбора рабочего пространства
    saveCurrentWorkspaceToLocalStorage(workspaceId);
  };

  const getCurrentWorkspaceId = () => {
    return localStorage.getItem('currentWorkspace') || 'personal';
  };

  const currentWorkspaceId = getCurrentWorkspaceId();

  const WorkspaceDropdownInner = (
    <div ref={menuRef as React.RefObject<HTMLDivElement>} className="workspace-dropdown">
      <div className="main-container">
        {allWorkspaces.map((workspace) => (
          <div
            key={workspace.id}
            className={`workspace-item ${getCurrentWorkspaceFromLocalStorage() === workspace.id ? 'selected' : ''}`}
            onClick={() => handleSelectWorkspace(workspace.id)}
          >
            <span className="workspace-name">{workspace.name}</span>
            {workspace.id !== 'personal' && (
              <button onClick={() => handleOpenWorkspaceSettings(workspace.id)}>Edit</button>
            )}
          </div>
        ))}

        <div className="create-workspace" onClick={() => handleOpenWorkspaceSettings()}>
          <span>Create a workspace</span>
        </div>

        <div className="automation-settings" onClick={handleOpenAutomationSettings}>
          <span>Automations</span>
        </div>

        <div className="settings">
          <div className="personal-settings" onClick={onSelectSettings}>
            <span>Personal settings</span>
          </div>
          {currentWorkspaceId !== 'personal' && (
            <div className="workspace-settings" onClick={() => handleOpenWorkspaceSettings(currentWorkspaceId)}>
              <span>Workspace settings</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
  cmdkRoot.render(isOpen ? WorkspaceDropdownInner : <div />);
  return <div />;
};

export default WorkspaceDropdown;
