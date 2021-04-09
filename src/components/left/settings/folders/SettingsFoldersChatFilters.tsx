import React, {
  FC, memo, useMemo, useCallback,
} from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../lib/teact/teactn';

import { GlobalActions } from '../../../../global/types';
import { ApiChat } from '../../../../api/types';

import { pick } from '../../../../util/iteratees';
import searchWords from '../../../../util/searchWords';
import { prepareChatList, getChatTitle } from '../../../../modules/helpers';
import {
  FoldersState,
  FolderEditDispatch,
  selectChatFilters,
} from '../../../../hooks/reducers/useFoldersReducer';

import SettingsFoldersChatsPicker from './SettingsFoldersChatsPicker';

import Loading from '../../../ui/Loading';

type OwnProps = {
  mode: 'included' | 'excluded';
  state: FoldersState;
  dispatch: FolderEditDispatch;
};

type StateProps = {
  chatsById: Record<number, ApiChat>;
  listIds?: number[];
  orderedPinnedIds?: number[];
  archivedListIds?: number[];
  archivedPinnedIds?: number[];
};

type DispatchProps = Pick<GlobalActions, 'loadMoreChats'>;

const SettingsFoldersChatFilters: FC<OwnProps & StateProps & DispatchProps> = ({
  mode,
  state,
  dispatch,
  chatsById,
  listIds,
  orderedPinnedIds,
  archivedListIds,
  archivedPinnedIds,
  loadMoreChats,
}) => {
  const { chatFilter } = state;
  const { selectedChatIds, selectedChatTypes } = selectChatFilters(state, mode, true);

  const chats = useMemo(() => {
    const activeChatArrays = listIds
      ? prepareChatList(chatsById, listIds, orderedPinnedIds, 'all')
      : undefined;
    const archivedChatArrays = archivedListIds
      ? prepareChatList(chatsById, archivedListIds, archivedPinnedIds, 'archived')
      : undefined;

    if (!activeChatArrays && !archivedChatArrays) {
      return undefined;
    }

    return [
      ...(activeChatArrays
        ? [...activeChatArrays.pinnedChats, ...activeChatArrays.otherChats]
        : []
      ),
      ...(archivedChatArrays ? archivedChatArrays.otherChats : []),
    ];
  }, [chatsById, listIds, orderedPinnedIds, archivedListIds, archivedPinnedIds]);

  const displayedIds = useMemo(() => {
    if (!chats) {
      return undefined;
    }

    return chats
      .filter((chat) => (
        !chatFilter
        || searchWords(getChatTitle(chat), chatFilter)
        || selectedChatIds.includes(chat.id)
      ))
      .map(({ id }) => id);
  }, [chats, chatFilter, selectedChatIds]);

  const handleFilterChange = useCallback((newFilter: string) => {
    dispatch({
      type: 'setChatFilter',
      payload: newFilter,
    });
  }, [dispatch]);

  const handleSelectedIdsChange = useCallback((ids: number[]) => {
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
      onLoadMore={loadMoreChats}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      chats: {
        byId: chatsById,
        listIds,
        orderedPinnedIds,
      },
    } = global;

    return {
      chatsById,
      listIds: listIds.active,
      orderedPinnedIds: orderedPinnedIds.active,
      archivedPinnedIds: orderedPinnedIds.archived,
      archivedListIds: listIds.archived,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['loadMoreChats']),
)(SettingsFoldersChatFilters));
