import React, {
  FC, memo, useCallback, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../modules';

import { ApiChatMember, ApiUserStatus } from '../../../api/types';
import { ManagementScreens } from '../../../types';

import { unique } from '../../../util/iteratees';
import { selectChat } from '../../../modules/selectors';
import {
  sortUserIds, isChatChannel, filterUsersByName, sortChatIds, isUserBot,
} from '../../../modules/helpers';
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
  adminMembers?: ApiChatMember[];
  isChannel?: boolean;
  localContactIds?: string[];
  searchQuery?: string;
  isSearching?: boolean;
  localUserIds?: string[];
  globalUserIds?: string[];
  serverTimeOffset: number;
};

const ManageGroupMembers: FC<OwnProps & StateProps> = ({
  noAdmins,
  members,
  adminMembers,
  userStatusesById,
  isChannel,
  isActive,
  globalUserIds,
  localContactIds,
  localUserIds,
  isSearching,
  searchQuery,
  serverTimeOffset,
  onClose,
  onScreenSelect,
  onChatMemberSelect,
}) => {
  const { openChat, setUserSearchQuery, loadContactList } = getActions();
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const adminIds = useMemo(() => {
    return noAdmins ? adminMembers?.map(({ userId }) => userId) || [] : [];
  }, [adminMembers, noAdmins]);

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

  const [viewportIds, getMore] = useInfiniteScroll(loadContactList, displayedIds, Boolean(searchQuery));

  const handleMemberClick = useCallback((id: string) => {
    if (noAdmins) {
      onChatMemberSelect!(id, false);
      onScreenSelect!(ManagementScreens.ChatNewAdminRights);
    } else {
      openChat({ id });
    }
  }, [noAdmins, onChatMemberSelect, onScreenSelect, openChat]);

  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUserSearchQuery({ query: e.target.value });
  }, [setUserSearchQuery]);
  const handleKeyDown = useKeyboardListNavigation(containerRef, isActive, (index) => {
    if (viewportIds && viewportIds.length > 0) {
      handleMemberClick(viewportIds[index === -1 ? 0 : index]);
    }
  }, '.ListItem-button', true);

  useHistoryBack(isActive, onClose);

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
                  onClick={() => handleMemberClick(id)}
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
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    const { statusesById: userStatusesById } = global.users;
    const members = chat?.fullInfo?.members;
    const adminMembers = chat?.fullInfo?.adminMembers;
    const isChannel = chat && isChatChannel(chat);
    const { userIds: localContactIds } = global.contactList || {};

    const {
      query: searchQuery,
      fetchingStatus,
      globalUserIds,
      localUserIds,
    } = global.userSearch;

    return {
      members,
      adminMembers,
      userStatusesById,
      isChannel,
      localContactIds,
      searchQuery,
      isSearching: fetchingStatus,
      globalUserIds,
      localUserIds,
      serverTimeOffset: global.serverTimeOffset,
    };
  },
)(ManageGroupMembers));
