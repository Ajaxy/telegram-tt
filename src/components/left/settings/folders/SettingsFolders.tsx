import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useCallback } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiChatFolder } from '../../../../api/types';
import type { FolderEditDispatch, FoldersState } from '../../../../hooks/reducers/useFoldersReducer';
import { SettingsScreens } from '../../../../types';

import { selectChatFilters } from '../../../../hooks/reducers/useFoldersReducer';

import SettingsFoldersChatFilters from './SettingsFoldersChatFilters';
import SettingsFoldersEdit, { ERROR_NO_CHATS, ERROR_NO_TITLE } from './SettingsFoldersEdit';
import SettingsFoldersMain from './SettingsFoldersMain';
import SettingsShareChatlist from './SettingsShareChatlist';

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
  const {
    openShareChatFolderModal,
    editChatFolder,
    addChatFolder,
  } = getActions();

  const handleReset = useCallback(() => {
    if (
      currentScreen === SettingsScreens.FoldersCreateFolder
      || currentScreen === SettingsScreens.FoldersEditFolder
      || currentScreen === SettingsScreens.FoldersEditFolderFromChatList
      || currentScreen === SettingsScreens.FoldersEditFolderInvites
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

  const isCreating = state.mode === 'create';

  const saveState = useCallback((newState: FoldersState) => {
    const { title } = newState.folder;

    if (!title) {
      dispatch({ type: 'setError', payload: ERROR_NO_TITLE });
      return false;
    }

    const {
      selectedChatIds: includedChatIds,
      selectedChatTypes: includedChatTypes,
    } = selectChatFilters(newState, 'included');

    if (!includedChatIds.length && !Object.keys(includedChatTypes).length) {
      dispatch({ type: 'setError', payload: ERROR_NO_CHATS });
      return false;
    }

    if (!isCreating) {
      editChatFolder({ id: newState.folderId!, folderUpdate: newState.folder });
    } else {
      addChatFolder({ folder: newState.folder as ApiChatFolder });
    }

    dispatch({ type: 'setError', payload: undefined });
    dispatch({ type: 'setIsTouched', payload: false });

    return true;
  }, [dispatch, isCreating]);

  const handleSaveFolder = useCallback((cb?: NoneToVoidFunction) => {
    if (!saveState(state)) {
      return;
    }
    cb?.();
  }, [saveState, state]);

  const handleSaveFilter = useCallback(() => {
    const newState = dispatch({ type: 'saveFilters' });
    handleReset();
    saveState(newState);
  }, [dispatch, handleReset, saveState]);

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

  const handleShareFolder = useCallback(() => {
    openShareChatFolderModal({ folderId: state.folderId!, noRequestNextScreen: true });
    dispatch({ type: 'setIsChatlist', payload: true });
    onScreenSelect(SettingsScreens.FoldersShare);
  }, [dispatch, onScreenSelect, state.folderId]);

  const handleOpenInvite = useCallback((url: string) => {
    openShareChatFolderModal({ folderId: state.folderId!, url, noRequestNextScreen: true });
    onScreenSelect(SettingsScreens.FoldersShare);
  }, [onScreenSelect, state.folderId]);

  switch (currentScreen) {
    case SettingsScreens.Folders:
      return (
        <SettingsFoldersMain
          onCreateFolder={handleCreateFolder}
          onEditFolder={handleEditFolder}
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
    case SettingsScreens.FoldersEditFolderInvites:
      return (
        <SettingsFoldersEdit
          state={state}
          dispatch={dispatch}
          onAddIncludedChats={handleAddIncludedChats}
          onAddExcludedChats={handleAddExcludedChats}
          onShareFolder={handleShareFolder}
          onOpenInvite={handleOpenInvite}
          onReset={handleReset}
          isActive={isActive || [
            SettingsScreens.FoldersIncludedChats,
            SettingsScreens.FoldersExcludedChats,
          ].includes(shownScreen)}
          isOnlyInvites={currentScreen === SettingsScreens.FoldersEditFolderInvites}
          onBack={onReset}
          onSaveFolder={handleSaveFolder}
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
          onSaveFilter={handleSaveFilter}
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
          onSaveFilter={handleSaveFilter}
          isActive={isActive}
        />
      );

    case SettingsScreens.FoldersShare:
      return (
        <SettingsShareChatlist
          isActive={isActive}
          onReset={handleReset}
        />
      );

    default:
      return undefined;
  }
};

export default memo(SettingsFolders);
