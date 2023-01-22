import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiChatMember, ApiUserStatus } from '../../../api/types';
import { ManagementScreens } from '../../../types';

import { unique } from '../../../util/iteratees';
import { selectChat } from '../../../global/selectors';
import {
  sortUserIds, isChatChannel, filterUsersByName, sortChatIds, isUserBot, getHasAdminRight, isChatBasicGroup,
} from '../../../global/helpers';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import useKeyboardListNavigation from '../../../hooks/useKeyboardListNavigation';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import NothingFound from '../../common/NothingFound';
import ListItem from '../../ui/ListItem';
import InputText from '../../ui/InputText';
import InfiniteScroll from '../../ui/InfiniteScroll';
import Loading from '../../ui/Loading';
import DeleteMemberModal from '../DeleteMemberModal';
import Switcher from '../../ui/Switcher';

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
  adminMembersById?: Record<string, ApiChatMember>;
  isChannel?: boolean;
  localContactIds?: string[];
  searchQuery?: string;
  isSearching?: boolean;
  localUserIds?: string[];
  globalUserIds?: string[];
  serverTimeOffset: number;
  currentUserId?: string;
  canDeleteMembers?: boolean;
  isBasicGroup?: boolean;
  areParticipantsHidden?: boolean;
};

const ManageGroupMembers: FC<OwnProps & StateProps> = ({
  chatId,
  noAdmins,
  members,
  adminMembersById,
  userStatusesById,
  isChannel,
  isActive,
  globalUserIds,
  localContactIds,
  localUserIds,
  isSearching,
  searchQuery,
  serverTimeOffset,
  currentUserId,
  canDeleteMembers,
  isBasicGroup,
  areParticipantsHidden,
  onClose,
  onScreenSelect,
  onChatMemberSelect,
}) => {
  const {
    openChat, setUserSearchQuery, closeManagement, toggleParticipantsHidden,
  } = getActions();
  const lang = useLang();
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
      undefined,
      serverTimeOffset,
    );

    return noAdmins ? userIds.filter((userId) => !adminIds.includes(userId)) : userIds;
  }, [members, userStatusesById, serverTimeOffset, noAdmins, adminIds]);

  const displayedIds = useMemo(() => {
    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;
    const chatsById = getGlobal().chats.byId;
    const shouldUseSearchResults = Boolean(searchQuery);
    const listedIds = !shouldUseSearchResults
      ? memberIds
      : (localContactIds ? filterUsersByName(localContactIds, usersById, searchQuery) : []);

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
      chatsById,
      true,
    );
  }, [memberIds, localContactIds, searchQuery, localUserIds, globalUserIds, isChannel, noAdmins, adminIds]);

  const [viewportIds, getMore] = useInfiniteScroll(undefined, displayedIds, Boolean(searchQuery));

  const handleMemberClick = useCallback((id: string) => {
    if (noAdmins) {
      onChatMemberSelect!(id, false);
      onScreenSelect!(ManagementScreens.ChatNewAdminRights);
    } else {
      closeManagement();
      openChat({ id });
    }
  }, [closeManagement, noAdmins, onChatMemberSelect, onScreenSelect, openChat]);

  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUserSearchQuery({ query: e.target.value });
  }, [setUserSearchQuery]);
  const handleKeyDown = useKeyboardListNavigation(containerRef, isActive, (index) => {
    if (viewportIds && viewportIds.length > 0) {
      handleMemberClick(viewportIds[index === -1 ? 0 : index]);
    }
  }, '.ListItem-button', true);

  const handleDeleteMembersModalClose = useCallback(() => {
    setDeletingUserId(undefined);
  }, []);

  const handleToggleParticipantsHidden = useCallback(() => {
    toggleParticipantsHidden({ chatId, isEnabled: !areParticipantsHidden });
  }, [areParticipantsHidden, chatId, toggleParticipantsHidden]);

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  function getMemberContextAction(memberId: string) {
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
        {!isBasicGroup && (
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
                  <PrivateChatInfo userId={id} forceShowSelf />
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
    const members = chat?.fullInfo?.members;
    const adminMembersById = chat?.fullInfo?.adminMembersById;
    const isChannel = chat && isChatChannel(chat);
    const { userIds: localContactIds } = global.contactList || {};

    const {
      query: searchQuery,
      fetchingStatus,
      globalUserIds,
      localUserIds,
    } = global.userSearch;

    const canDeleteMembers = chat && (chat.isCreator || getHasAdminRight(chat, 'banUsers'));

    return {
      isBasicGroup: Boolean(chat && isChatBasicGroup(chat)),
      areParticipantsHidden: Boolean(chat && chat.fullInfo?.areParticipantsHidden),
      members,
      adminMembersById,
      userStatusesById,
      isChannel,
      localContactIds,
      searchQuery,
      isSearching: fetchingStatus,
      globalUserIds,
      localUserIds,
      canDeleteMembers,
      serverTimeOffset: global.serverTimeOffset,
      currentUserId: global.currentUserId,
    };
  },
)(ManageGroupMembers));
