import type { FC } from '../../lib/teact/teact';
import React, {
  useCallback, useMemo, memo, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type {
  ApiChat, ApiChatMember,
} from '../../api/types';
import { NewChatMembersProgress } from '../../types';

import { unique } from '../../util/iteratees';
import { selectChat, selectTabState } from '../../global/selectors';
import {
  filterUsersByName, isChatChannel, isUserBot, sortChatIds,
} from '../../global/helpers';
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
  const { setUserSearchQuery } = getActions();

  const lang = useLang();
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const prevSelectedMemberIds = usePrevious(selectedMemberIds);
  const noPickerScrollRestore = prevSelectedMemberIds === selectedMemberIds;

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

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
    const { newChatMembersProgress } = selectTabState(global);
    const { currentUserId } = global;
    const isChannel = chat && isChatChannel(chat);

    const {
      query: searchQuery,
      fetchingStatus,
      globalUserIds,
      localUserIds,
    } = selectTabState(global).userSearch;

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
    };
  },
)(AddChatMembers));
