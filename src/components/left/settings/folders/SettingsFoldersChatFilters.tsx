import type { FC } from '../../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { FolderEditDispatch, FoldersState } from '../../../../hooks/reducers/useFoldersReducer';

import { ALL_FOLDER_ID, ARCHIVED_FOLDER_ID } from '../../../../config';
import { filterPeersByQuery } from '../../../../global/helpers/peers';
import { selectCurrentLimit } from '../../../../global/selectors/limits';
import { unique } from '../../../../util/iteratees';
import { CUSTOM_PEER_EXCLUDED_CHAT_TYPES, CUSTOM_PEER_INCLUDED_CHAT_TYPES } from '../../../../util/objects/customPeer';

import { selectChatFilters } from '../../../../hooks/reducers/useFoldersReducer';
import { useFolderManagerForOrderedIds } from '../../../../hooks/useFolderManager';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';

import Icon from '../../../common/icons/Icon';
import PeerPicker from '../../../common/pickers/PeerPicker';
import FloatingActionButton from '../../../ui/FloatingActionButton';
import Loading from '../../../ui/Loading';

type StateProps = {
  maxChats: number;
};

type OwnProps = {
  mode: 'included' | 'excluded';
  state: FoldersState;
  dispatch: FolderEditDispatch;
  isActive?: boolean;
  onReset: VoidFunction;
  onSaveFilter: VoidFunction;
};

const SettingsFoldersChatFilters: FC<OwnProps & StateProps> = ({
  mode,
  state,
  dispatch,
  isActive,
  onReset,
  onSaveFilter,
  maxChats,
}) => {
  const lang = useOldLang();

  const { openLimitReachedModal } = getActions();

  const { chatFilter } = state;
  const { selectedChatIds, selectedChatTypes } = useMemo(() => selectChatFilters(state, mode, true), [mode, state]);
  const chatTypes = mode === 'included' ? CUSTOM_PEER_INCLUDED_CHAT_TYPES : CUSTOM_PEER_EXCLUDED_CHAT_TYPES;

  const [isTouched, setIsTouched] = useState(false);

  const folderAllOrderedIds = useFolderManagerForOrderedIds(ALL_FOLDER_ID);
  const folderArchivedOrderedIds = useFolderManagerForOrderedIds(ARCHIVED_FOLDER_ID);

  const shouldHideChatTypes = state.folder.isChatList;

  useEffect(() => {
    if (!isActive) {
      setIsTouched(false);
    }
  }, [isActive]);

  const displayedIds = useMemo(() => {
    const chatIds = [...folderAllOrderedIds || [], ...folderArchivedOrderedIds || []];
    return unique([
      ...filterPeersByQuery({ ids: chatIds, query: chatFilter, type: 'chat' }),
    ]);
  }, [folderAllOrderedIds, folderArchivedOrderedIds, chatFilter]);

  const handleFilterChange = useLastCallback((newFilter: string) => {
    dispatch({
      type: 'setChatFilter',
      payload: newFilter,
    });
    setIsTouched(true);
  });

  const handleSelectedIdsChange = useLastCallback((ids: string[]) => {
    if (mode === 'included') {
      if (ids.length >= maxChats) {
        openLimitReachedModal({
          limit: 'dialogFiltersChats',
        });
        return;
      }
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
    setIsTouched(true);
  });

  const handleSelectedChatTypesChange = useLastCallback((keys: string[]) => {
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
    setIsTouched(true);
  });

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  if (!displayedIds) {
    return <Loading />;
  }

  return (
    <div className="Picker settings-folders-chat-list">
      <PeerPicker
        categories={shouldHideChatTypes ? undefined : chatTypes}
        itemIds={displayedIds}
        selectedIds={selectedChatIds}
        selectedCategories={selectedChatTypes}
        filterValue={chatFilter}
        filterPlaceholder={lang('Search')}
        categoryPlaceholderKey="FilterChatTypes"
        searchInputId="new-group-picker-search"
        isSearchable
        withDefaultPadding
        withPeerTypes
        allowMultiple
        itemInputType="checkbox"
        onSelectedIdsChange={handleSelectedIdsChange}
        onSelectedCategoriesChange={handleSelectedChatTypesChange}
        onFilterChange={handleFilterChange}
      />

      <FloatingActionButton
        isShown={isTouched}
        onClick={onSaveFilter}
        ariaLabel={lang('Save')}
      >
        <Icon name="check" />
      </FloatingActionButton>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      maxChats: selectCurrentLimit(global, 'dialogFiltersChats'),
    };
  },
)(SettingsFoldersChatFilters));
