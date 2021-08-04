import React, { FC, memo, useCallback } from '../../../../lib/teact/teact';

import { ApiChatFolder } from '../../../../api/types';
import { SettingsScreens } from '../../../../types';

import { FolderEditDispatch, FoldersState } from '../../../../hooks/reducers/useFoldersReducer';

import SettingsFoldersMain from './SettingsFoldersMain';
import SettingsFoldersEdit from './SettingsFoldersEdit';
import SettingsFoldersChatFilters from './SettingsFoldersChatFilters';

import './SettingsFolders.scss';

const TRANSITION_DURATION = 200;

export type OwnProps = {
  currentScreen: SettingsScreens;
  shownScreen: SettingsScreens;
  state: FoldersState;
  dispatch: FolderEditDispatch;
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

const SettingsFolders: FC<OwnProps> = ({
  currentScreen,
  shownScreen,
  state,
  dispatch,
  isActive,
  onScreenSelect,
  onReset,
}) => {
  const handleReset = useCallback(() => {
    if (
      currentScreen === SettingsScreens.FoldersCreateFolder
      || currentScreen === SettingsScreens.FoldersEditFolder
      || currentScreen === SettingsScreens.FoldersEditFolderFromChatList
    ) {
      setTimeout(() => {
        dispatch({ type: 'reset' });
      }, TRANSITION_DURATION);
    }

    if (
      currentScreen === SettingsScreens.FoldersIncludedChats
      || currentScreen === SettingsScreens.FoldersExcludedChats
    ) {
      if (state.mode === 'create') {
        onScreenSelect(SettingsScreens.FoldersCreateFolder);
      } else {
        onScreenSelect(SettingsScreens.FoldersEditFolder);
      }
      return;
    }

    onReset();
  }, [
    state.mode, dispatch,
    currentScreen, onReset, onScreenSelect,
  ]);

  const handleCreateFolder = useCallback(() => {
    dispatch({ type: 'reset' });
    onScreenSelect(SettingsScreens.FoldersCreateFolder);
  }, [onScreenSelect, dispatch]);

  const handleEditFolder = useCallback((folder: ApiChatFolder) => {
    dispatch({ type: 'editFolder', payload: folder });
    onScreenSelect(SettingsScreens.FoldersEditFolder);
  }, [dispatch, onScreenSelect]);

  const handleAddIncludedChats = useCallback(() => {
    dispatch({ type: 'editIncludeFilters' });
    onScreenSelect(currentScreen === SettingsScreens.FoldersEditFolderFromChatList
      ? SettingsScreens.FoldersIncludedChatsFromChatList
      : SettingsScreens.FoldersIncludedChats);
  }, [currentScreen, dispatch, onScreenSelect]);

  const handleAddExcludedChats = useCallback(() => {
    dispatch({ type: 'editExcludeFilters' });
    onScreenSelect(currentScreen === SettingsScreens.FoldersEditFolderFromChatList
      ? SettingsScreens.FoldersExcludedChatsFromChatList
      : SettingsScreens.FoldersExcludedChats);
  }, [currentScreen, dispatch, onScreenSelect]);

  switch (currentScreen) {
    case SettingsScreens.Folders:
      return (
        <SettingsFoldersMain
          onCreateFolder={handleCreateFolder}
          onEditFolder={handleEditFolder}
          onScreenSelect={onScreenSelect}
          isActive={isActive || [
            SettingsScreens.FoldersCreateFolder,
            SettingsScreens.FoldersEditFolder,
            SettingsScreens.FoldersIncludedChats,
            SettingsScreens.FoldersExcludedChats,
          ].includes(shownScreen)}
          onReset={onReset}
        />
      );
    case SettingsScreens.FoldersCreateFolder:
    case SettingsScreens.FoldersEditFolder:
    case SettingsScreens.FoldersEditFolderFromChatList:
      return (
        <SettingsFoldersEdit
          state={state}
          dispatch={dispatch}
          onAddIncludedChats={handleAddIncludedChats}
          onAddExcludedChats={handleAddExcludedChats}
          onReset={handleReset}
          onScreenSelect={onScreenSelect}
          isActive={isActive || [
            SettingsScreens.FoldersIncludedChats,
            SettingsScreens.FoldersExcludedChats,
          ].includes(shownScreen)}
          onBack={onReset}
        />
      );
    case SettingsScreens.FoldersIncludedChats:
    case SettingsScreens.FoldersIncludedChatsFromChatList:
      return (
        <SettingsFoldersChatFilters
          mode="included"
          state={state}
          dispatch={dispatch}
          onReset={handleReset}
          onScreenSelect={onScreenSelect}
          isActive={isActive}
        />
      );
    case SettingsScreens.FoldersExcludedChats:
    case SettingsScreens.FoldersExcludedChatsFromChatList:
      return (
        <SettingsFoldersChatFilters
          mode="excluded"
          state={state}
          dispatch={dispatch}
          onReset={handleReset}
          onScreenSelect={onScreenSelect}
          isActive={isActive}
        />
      );

    default:
      return undefined;
  }
};

export default memo(SettingsFolders);
