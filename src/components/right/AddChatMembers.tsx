import React, {
  FC, useCallback, useMemo, memo, useState, useEffect,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../modules';

import {
  ApiChat, ApiChatMember, ApiUpdateConnectionStateType,
} from '../../api/types';
import { NewChatMembersProgress } from '../../types';

import { unique } from '../../util/iteratees';
import { selectChat } from '../../modules/selectors';
import {
  filterUsersByName, isChatChannel, isUserBot, sortChatIds,
} from '../../modules/helpers';
import useLang from '../../hooks/useLang';
import usePrevious from '../../hooks/usePrevious';
import useHistoryBack from '../../hooks/useHistoryBack';

import Picker from '../common/Picker';
import FloatingActionButton from '../ui/FloatingActionButton';
import Spinner from '../ui/Spinner';

import './AddChatMembers.scss';

export type OwnProps = {
  chatId: string;
  isActive: boolean;
  onNextStep: (memberIds: string[]) => void;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  connectionState?: ApiUpdateConnectionStateType;
  isChannel?: boolean;
  members?: ApiChatMember[];
  currentUserId?: string;
  chatsById: Record<string, ApiChat>;
  localContactIds?: string[];
  searchQuery?: string;
  isLoading: boolean;
  isSearching?: boolean;
  localUserIds?: string[];
  globalUserIds?: string[];
};

const AddChatMembers: FC<OwnProps & StateProps> = ({
  isChannel,
  connectionState,
  members,
  onNextStep,
  currentUserId,
  chatsById,
  localContactIds,
  isLoading,
  searchQuery,
  isSearching,
  localUserIds,
  globalUserIds,
  onClose,
  isActive,
}) => {
  const { setUserSearchQuery, loadContactList } = getActions();

  const lang = useLang();
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const prevSelectedMemberIds = usePrevious(selectedMemberIds);
  const noPickerScrollRestore = prevSelectedMemberIds === selectedMemberIds;

  useEffect(() => {
    if (isActive && connectionState === 'connectionStateReady') {
      loadContactList();
    }
  }, [connectionState, isActive, loadContactList]);

  useHistoryBack(isActive, onClose);

  const memberIds = useMemo(() => {
    return members ? members.map((member) => member.userId) : [];
  }, [members]);

  const handleFilterChange = useCallback((query: string) => {
    setUserSearchQuery({ query });
  }, [setUserSearchQuery]);

  const displayedIds = useMemo(() => {
    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;
    const filteredContactIds = localContactIds ? filterUsersByName(localContactIds, usersById, searchQuery) : [];

    return sortChatIds(
      unique([
        ...filteredContactIds,
        ...(localUserIds || []),
        ...(globalUserIds || []),
      ]).filter((userId) => {
        const user = usersById[userId];

        // The user can be added to the chat if the following conditions are met:
        // the user has not yet been added to the current chat
        // AND it is not the current user,
        // AND (it is not found (user from global search) OR it is not a bot OR it is a bot,
        // but the current chat is not a channel AND the appropriate permission is set).
        return (
          !memberIds.includes(userId)
          && userId !== currentUserId
          && (!user || !isUserBot(user) || (!isChannel && user.canBeInvitedToGroup))
        );
      }),
      chatsById,
    );
  }, [
    localContactIds, chatsById, searchQuery, localUserIds, globalUserIds, currentUserId, memberIds, isChannel,
  ]);

  const handleNextStep = useCallback(() => {
    if (selectedMemberIds.length) {
      setUserSearchQuery({ query: '' });
      onNextStep(selectedMemberIds);
    }
  }, [selectedMemberIds, setUserSearchQuery, onNextStep]);

  return (
    <div className="AddChatMembers">
      <div className="AddChatMembers-inner">
        <Picker
          itemIds={displayedIds}
          selectedIds={selectedMemberIds}
          filterValue={searchQuery}
          filterPlaceholder={lang('lng_channel_add_users')}
          searchInputId="new-members-picker-search"
          isLoading={isSearching}
          onSelectedIdsChange={setSelectedMemberIds}
          onFilterChange={handleFilterChange}
          noScrollRestore={noPickerScrollRestore}
        />

        <FloatingActionButton
          isShown={Boolean(selectedMemberIds.length)}
          disabled={isLoading}
          ariaLabel={lang('lng_channel_add_users')}
          onClick={handleNextStep}
        >
          {isLoading ? (
            <Spinner color="white" />
          ) : (
            <i className="icon-arrow-right" />
          )}
        </FloatingActionButton>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    const { userIds: localContactIds } = global.contactList || {};
    const { byId: chatsById } = global.chats;
    const { currentUserId, newChatMembersProgress, connectionState } = global;
    const isChannel = chat && isChatChannel(chat);

    const {
      query: searchQuery,
      fetchingStatus,
      globalUserIds,
      localUserIds,
    } = global.userSearch;

    return {
      isChannel,
      members: chat?.fullInfo?.members,
      currentUserId,
      chatsById,
      localContactIds,
      searchQuery,
      isSearching: fetchingStatus,
      isLoading: newChatMembersProgress === NewChatMembersProgress.Loading,
      globalUserIds,
      localUserIds,
      connectionState,
    };
  },
)(AddChatMembers));
