import React, { FC, memo, useCallback } from '../../../../lib/teact/teact';

import { ApiChatFolder } from '../../../../api/types';
import { SettingsScreens } from '../../../../types';

import { FoldersState, FolderEditDispatch } from '../../../../hooks/reducers/useFoldersReducer';

import SettingsFoldersMain from './SettingsFoldersMain';
import SettingsFoldersEdit from './SettingsFoldersEdit';
import SettingsFoldersChatFilters from './SettingsFoldersChatFilters';

import './SettingsFolders.scss';

const TRANSITION_DURATION = 200;

export type OwnProps = {
  currentScreen: SettingsScreens;
  state: FoldersState;
  dispatch: FolderEditDispatch;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

const SettingsFolders: FC<OwnProps> = ({
  currentScreen,
  state,
  dispatch,
  onScreenSelect,
  onReset,
}) => {
  const handleReset = useCallback(() => {
    if (
      currentScreen === SettingsScreens.FoldersCreateFolder
      || currentScreen === SettingsScreens.FoldersEditFolder
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
    onScreenSelect(SettingsScreens.FoldersIncludedChats);
  }, [dispatch, onScreenSelect]);

  const handleAddExcludedChats = useCallback(() => {
    dispatch({ type: 'editExcludeFilters' });
    onScreenSelect(SettingsScreens.FoldersExcludedChats);
  }, [dispatch, onScreenSelect]);

  switch (currentScreen) {
    case SettingsScreens.Folders:
      return (
        <SettingsFoldersMain
          onCreateFolder={handleCreateFolder}
          onEditFolder={handleEditFolder}
        />
      );
    case SettingsScreens.FoldersCreateFolder:
    case SettingsScreens.FoldersEditFolder:
      return (
        <SettingsFoldersEdit
          state={state}
          dispatch={dispatch}
          onAddIncludedChats={handleAddIncludedChats}
          onAddExcludedChats={handleAddExcludedChats}
          onReset={handleReset}
        />
      );
    case SettingsScreens.FoldersIncludedChats:
      return (
        <SettingsFoldersChatFilters
          mode="included"
          state={state}
          dispatch={dispatch}
        />
      );
    case SettingsScreens.FoldersExcludedChats:
      return (
        <SettingsFoldersChatFilters
          mode="excluded"
          state={state}
          dispatch={dispatch}
        />
      );

    default:
      return undefined;
  }
};

export default memo(SettingsFolders);
