import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiChatMember, ApiUserStatus } from '../../../api/types';
import { ManagementScreens, NewChatMembersProgress } from '../../../types';

import {
  getHasAdminRight, isChatBasicGroup,
  isChatChannel, isUserBot, isUserRightBanned, sortUserIds,
} from '../../../global/helpers';
import { filterPeersByQuery } from '../../../global/helpers/peers';
import { selectChat, selectChatFullInfo, selectTabState } from '../../../global/selectors';
import { unique } from '../../../util/iteratees';
import sortChatIds from '../../common/helpers/sortChatIds';

import usePeerStoriesPolling from '../../../hooks/polling/usePeerStoriesPolling';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import useKeyboardListNavigation from '../../../hooks/useKeyboardListNavigation';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import NothingFound from '../../common/NothingFound';
import PrivateChatInfo from '../../common/PrivateChatInfo';
import FloatingActionButton from '../../ui/FloatingActionButton';
import InfiniteScroll from '../../ui/InfiniteScroll';
import InputText from '../../ui/InputText';
import ListItem, { type MenuItemContextAction } from '../../ui/ListItem';
import Loading from '../../ui/Loading';
import Switcher from '../../ui/Switcher';
import DeleteMemberModal from '../DeleteMemberModal';

type OwnProps = {
  chatId: string;
  isActive: boolean;
  noAdmins?: boolean;
  onClose: NoneToVoidFunction;
  onScreenSelect?: (screen: ManagementScreens) => void;
  onChatMemberSelect?: (memberId: string, isPromotedByCurrentUser?: boolean) => void;
};

type StateProps = {
  userStatusesById: Record<string, ApiUserStatus>;
  members?: ApiChatMember[];
  canAddMembers?: boolean;
  adminMembersById?: Record<string, ApiChatMember>;
  isChannel?: boolean;
  localContactIds?: string[];
  searchQuery?: string;
  isSearching?: boolean;
  localUserIds?: string[];
  globalUserIds?: string[];
  currentUserId?: string;
  canDeleteMembers?: boolean;
  areParticipantsHidden?: boolean;
  canHideParticipants?: boolean;
};

const ManageGroupMembers: FC<OwnProps & StateProps> = ({
  chatId,
  noAdmins,
  members,
  canAddMembers,
  adminMembersById,
  userStatusesById,
  isChannel,
  isActive,
  globalUserIds,
  localContactIds,
  localUserIds,
  isSearching,
  searchQuery,
  currentUserId,
  canDeleteMembers,
  areParticipantsHidden,
  canHideParticipants,
  onClose,
  onScreenSelect,
  onChatMemberSelect,
}) => {
  const {
    openChat, setUserSearchQuery, closeManagement,
    toggleParticipantsHidden, setNewChatMembersDialogState, toggleManagement,
  } = getActions();
  const lang = useOldLang();
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const [deletingUserId, setDeletingUserId] = useState<string | undefined>();

  const adminIds = useMemo(() => {
    return noAdmins && adminMembersById ? Object.keys(adminMembersById) : [];
  }, [adminMembersById, noAdmins]);

  const memberIds = useMemo(() => {
    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;
    if (!members || !usersById) {
      return [];
    }

    const userIds = sortUserIds(
      members.map(({ userId }) => userId),
      usersById,
      userStatusesById,
    );

    return noAdmins ? userIds.filter((userId) => !adminIds.includes(userId)) : userIds;
  }, [members, userStatusesById, noAdmins, adminIds]);

  usePeerStoriesPolling(memberIds);

  const displayedIds = useMemo(() => {
    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;
    const shouldUseSearchResults = Boolean(searchQuery);
    const listedIds = !shouldUseSearchResults
      ? memberIds
      : (localContactIds ? filterPeersByQuery({ ids: localContactIds, query: searchQuery, type: 'user' }) : []);

    return sortChatIds(
      unique([
        ...listedIds,
        ...(shouldUseSearchResults ? localUserIds || [] : []),
        ...(shouldUseSearchResults ? globalUserIds || [] : []),
      ]).filter((contactId) => {
        const user = usersById[contactId];
        if (!user) {
          return true;
        }

        return (isChannel || user.canBeInvitedToGroup || !isUserBot(user))
          && (!noAdmins || !adminIds.includes(contactId));
      }),
      true,
    );
  }, [memberIds, localContactIds, searchQuery, localUserIds, globalUserIds, isChannel, noAdmins, adminIds]);

  const [viewportIds, getMore] = useInfiniteScroll(undefined, displayedIds, Boolean(searchQuery));

  const handleMemberClick = useLastCallback((id: string) => {
    if (noAdmins) {
      onChatMemberSelect!(id, true);
      onScreenSelect!(ManagementScreens.ChatNewAdminRights);
    } else {
      closeManagement();
      openChat({ id });
    }
  });

  const handleFilterChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUserSearchQuery({ query: e.target.value });
  });

  const handleKeyDown = useKeyboardListNavigation(containerRef, isActive, (index) => {
    if (viewportIds && viewportIds.length > 0) {
      handleMemberClick(viewportIds[index === -1 ? 0 : index]);
    }
  }, '.ListItem-button', true);

  const handleDeleteMembersModalClose = useLastCallback(() => {
    setDeletingUserId(undefined);
  });

  const handleToggleParticipantsHidden = useLastCallback(() => {
    toggleParticipantsHidden({ chatId, isEnabled: !areParticipantsHidden });
  });

  const handleNewMemberDialogOpen = useLastCallback(() => {
    toggleManagement();
    setNewChatMembersDialogState({ newChatMembersProgress: NewChatMembersProgress.InProgress });
  });

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  function getMemberContextAction(memberId: string): MenuItemContextAction[] | undefined {
    return memberId === currentUserId || !canDeleteMembers ? undefined : [{
      title: lang('lng_context_remove_from_group'),
      icon: 'stop',
      handler: () => {
        setDeletingUserId(memberId);
      },
    }];
  }

  function renderSearchField() {
    return (
      <div className="Management__filter" dir={lang.isRtl ? 'rtl' : undefined}>
        <InputText
          ref={inputRef}
          value={searchQuery}
          onChange={handleFilterChange}
          placeholder={lang('Search')}
        />
      </div>
    );
  }

  return (
    <div className="Management">
      {noAdmins && renderSearchField()}
      <div className="custom-scroll">
        {canHideParticipants && !isChannel && (
          <div className="section">
            <ListItem icon="group" ripple onClick={handleToggleParticipantsHidden}>
              <span>{lang('ChannelHideMembers')}</span>
              <Switcher label={lang('ChannelHideMembers')} checked={areParticipantsHidden} />
            </ListItem>
            <p className="section-info">
              {lang(areParticipantsHidden ? 'GroupMembers.MembersHiddenOn' : 'GroupMembers.MembersHiddenOff')}
            </p>
          </div>
        )}
        <div className="section">
          {viewportIds?.length ? (
            <InfiniteScroll
              className="picker-list custom-scroll"
              items={displayedIds}
              onLoadMore={getMore}
              noScrollRestore={Boolean(searchQuery)}
              ref={containerRef}
              onKeyDown={handleKeyDown}
            >
              {viewportIds.map((id) => (
                <ListItem
                  key={id}
                  className="chat-item-clickable scroll-item"
                  // eslint-disable-next-line react/jsx-no-bind
                  onClick={() => handleMemberClick(id)}
                  contextActions={getMemberContextAction(id)}
                >
                  <PrivateChatInfo userId={id} forceShowSelf withStory />
                </ListItem>
              ))}
            </InfiniteScroll>
          ) : !isSearching && viewportIds && !viewportIds.length ? (
            <NothingFound
              teactOrderKey={0}
              key="nothing-found"
              text={isChannel ? 'No subscribers found' : 'No members found'}
            />
          ) : (
            <Loading />
          )}
        </div>
      </div>
      {canAddMembers && (
        <FloatingActionButton
          isShown
          onClick={handleNewMemberDialogOpen}
          ariaLabel={lang('lng_channel_add_users')}
        >
          <Icon name="add-user-filled" />
        </FloatingActionButton>
      )}
      {canDeleteMembers && (
        <DeleteMemberModal
          isOpen={Boolean(deletingUserId)}
          userId={deletingUserId}
          onClose={handleDeleteMembersModalClose}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    const { statusesById: userStatusesById } = global.users;
    const { members, adminMembersById, areParticipantsHidden } = selectChatFullInfo(global, chatId) || {};
    const isChannel = chat && isChatChannel(chat);
    const { userIds: localContactIds } = global.contactList || {};
    const hiddenMembersMinCount = global.appConfig?.hiddenMembersMinCount;

    const canDeleteMembers = chat && (chat.isCreator || getHasAdminRight(chat, 'banUsers'));

    const canHideParticipants = canDeleteMembers && !isChatBasicGroup(chat) && chat.membersCount !== undefined
    && hiddenMembersMinCount !== undefined && chat.membersCount >= hiddenMembersMinCount;

    const canAddMembers = chat && ((getHasAdminRight(chat, 'inviteUsers')
        || (!isChannel && !isUserRightBanned(chat, 'inviteUsers')))
      || chat.isCreator
    );

    const {
      query: searchQuery,
      fetchingStatus,
      globalUserIds,
      localUserIds,
    } = selectTabState(global).userSearch;

    return {
      areParticipantsHidden: Boolean(chat && areParticipantsHidden),
      members,
      canAddMembers,
      adminMembersById,
      userStatusesById,
      isChannel,
      localContactIds,
      searchQuery,
      isSearching: fetchingStatus,
      globalUserIds,
      localUserIds,
      canDeleteMembers,
      currentUserId: global.currentUserId,
      canHideParticipants,
    };
  },
)(ManageGroupMembers));
