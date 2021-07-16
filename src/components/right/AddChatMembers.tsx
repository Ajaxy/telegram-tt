import React, {
  FC, useCallback, useMemo, memo, useState, useEffect,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import {
  ApiChat, ApiChatMember, ApiUpdateConnectionStateType, ApiUser,
} from '../../api/types';
import { NewChatMembersProgress } from '../../types';

import { pick, unique } from '../../util/iteratees';
import { selectChat } from '../../modules/selectors';
import searchWords from '../../util/searchWords';
import {
  getUserFullName, isChatChannel, isUserBot, sortChatIds,
} from '../../modules/helpers';
import useLang from '../../hooks/useLang';
import usePrevious from '../../hooks/usePrevious';
import useHistoryBack from '../../hooks/useHistoryBack';

import Picker from '../common/Picker';
import FloatingActionButton from '../ui/FloatingActionButton';
import Spinner from '../ui/Spinner';

import './AddChatMembers.scss';

export type OwnProps = {
  chatId: number;
  isActive: boolean;
  onNextStep: (memberIds: number[]) => void;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  connectionState?: ApiUpdateConnectionStateType;
  isChannel?: boolean;
  members?: ApiChatMember[];
  currentUserId?: number;
  usersById: Record<number, ApiUser>;
  chatsById: Record<number, ApiChat>;
  localContactIds?: number[];
  searchQuery?: string;
  isLoading: boolean;
  isSearching?: boolean;
  localUserIds?: number[];
  globalUserIds?: number[];
};

type DispatchProps = Pick<GlobalActions, 'loadContactList' | 'setUserSearchQuery'>;

const AddChatMembers: FC<OwnProps & StateProps & DispatchProps> = ({
  isChannel,
  connectionState,
  members,
  onNextStep,
  currentUserId,
  usersById,
  chatsById,
  localContactIds,
  isLoading,
  searchQuery,
  isSearching,
  localUserIds,
  globalUserIds,
  setUserSearchQuery,
  onClose,
  isActive,
  loadContactList,
}) => {
  const lang = useLang();
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
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
    const contactIds = localContactIds
      ? sortChatIds(localContactIds.filter((id) => id !== currentUserId), chatsById)
      : [];

    if (!searchQuery) {
      return contactIds.filter((id) => !memberIds.includes(id));
    }

    const foundContactIds = contactIds.filter((id) => {
      const user = usersById[id];
      if (!user) {
        return false;
      }
      const fullName = getUserFullName(user);
      return fullName && searchWords(fullName, searchQuery);
    });

    return sortChatIds(
      unique([
        ...foundContactIds,
        ...(localUserIds || []),
        ...(globalUserIds || []),
      ]).filter((contactId) => {
        const user = usersById[contactId];

        // The user can be added to the chat if the following conditions are met:
        // the user has not yet been added to the current chat
        // AND (it is not found (user from global search) OR it is not a bot OR it is a bot,
        // but the current chat is not a channel AND the appropriate permission is set).
        return !memberIds.includes(contactId)
          && (!user || !isUserBot(user) || (!isChannel && user.canBeInvitedToGroup));
      }),
      chatsById,
    );
  }, [
    localContactIds, chatsById, searchQuery, localUserIds, globalUserIds,
    currentUserId, usersById, memberIds, isChannel,
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
    const { byId: usersById } = global.users;
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
      members: chat && chat.fullInfo ? chat.fullInfo.members : undefined,
      currentUserId,
      usersById,
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
  (setGlobal, actions): DispatchProps => pick(actions, ['loadContactList', 'setUserSearchQuery']),
)(AddChatMembers));
