import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useMemo, useCallback } from '../../../../lib/teact/teact';
import { getGlobal } from '../../../../global';

import { unique } from '../../../../util/iteratees';

import { ALL_FOLDER_ID, ARCHIVED_FOLDER_ID } from '../../../../config';
import { filterChatsByName } from '../../../../global/helpers';
import useLang from '../../../../hooks/useLang';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import { useFolderManagerForOrderedIds } from '../../../../hooks/useFolderManager';
import type {
  FoldersState,
  FolderEditDispatch,
} from '../../../../hooks/reducers/useFoldersReducer';
import {
  selectChatFilters,
} from '../../../../hooks/reducers/useFoldersReducer';

import SettingsFoldersChatsPicker from './SettingsFoldersChatsPicker';
import Loading from '../../../ui/Loading';

type OwnProps = {
  mode: 'included' | 'excluded';
  state: FoldersState;
  dispatch: FolderEditDispatch;
  isActive?: boolean;
  onReset: () => void;
};

const SettingsFoldersChatFilters: FC<OwnProps> = ({
  mode,
  state,
  dispatch,
  isActive,
  onReset,
}) => {
  const { chatFilter } = state;
  const { selectedChatIds, selectedChatTypes } = selectChatFilters(state, mode, true);

  const lang = useLang();

  const folderAllOrderedIds = useFolderManagerForOrderedIds(ALL_FOLDER_ID);
  const folderArchivedOrderedIds = useFolderManagerForOrderedIds(ARCHIVED_FOLDER_ID);

  const displayedIds = useMemo(() => {
    // No need for expensive global updates on chats, so we avoid them
    const chatsById = getGlobal().chats.byId;

    const chatIds = [...folderAllOrderedIds || [], ...folderArchivedOrderedIds || []];
    return unique([
      ...selectedChatIds,
      ...filterChatsByName(lang, chatIds, chatsById, chatFilter),
    ]);
  }, [folderAllOrderedIds, folderArchivedOrderedIds, selectedChatIds, lang, chatFilter]);

  const handleFilterChange = useCallback((newFilter: string) => {
    dispatch({
      type: 'setChatFilter',
      payload: newFilter,
    });
  }, [dispatch]);

  const handleSelectedIdsChange = useCallback((ids: string[]) => {
    if (mode === 'included') {
      dispatch({
        type: 'setIncludeFilters',
        payload: { ...state.includeFilters, includedChatIds: ids },
      });
    } else {
      dispatch({
        type: 'setExcludeFilters',
        payload: { ...state.excludeFilters, excludedChatIds: ids },
      });
    }
  }, [mode, state, dispatch]);

  const handleSelectedChatTypesChange = useCallback((keys: string[]) => {
    const newFilters: Record<string, boolean> = {};
    keys.forEach((key) => {
      newFilters[key] = true;
    });

    if (mode === 'included') {
      dispatch({
        type: 'setIncludeFilters',
        payload: {
          includedChatIds: selectedChatIds,
          ...newFilters,
        },
      });
    } else {
      dispatch({
        type: 'setExcludeFilters',
        payload: {
          excludedChatIds: selectedChatIds,
          ...newFilters,
        },
      });
    }
  }, [mode, selectedChatIds, dispatch]);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  if (!displayedIds) {
    return <Loading />;
  }

  return (
    <SettingsFoldersChatsPicker
      mode={mode}
      chatIds={displayedIds}
      selectedIds={selectedChatIds}
      selectedChatTypes={selectedChatTypes}
      filterValue={chatFilter}
      onSelectedIdsChange={handleSelectedIdsChange}
      onSelectedChatTypesChange={handleSelectedChatTypesChange}
      onFilterChange={handleFilterChange}
    />
  );
};

export default memo(SettingsFoldersChatFilters);
