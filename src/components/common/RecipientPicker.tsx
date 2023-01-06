import React, { memo, useMemo, useState } from '../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { ApiChat, ApiChatType } from '../../api/types';
import { MAIN_THREAD_ID } from '../../api/types';

import { API_CHAT_TYPES } from '../../config';
import { unique } from '../../util/iteratees';
import {
  filterChatsByName,
  filterUsersByName,
  getCanPostInChat,
  isDeletedUser,
  sortChatIds,
} from '../../global/helpers';

import useLang from '../../hooks/useLang';

import ChatOrUserPicker from './ChatOrUserPicker';
import { filterChatIdsByType } from '../../global/selectors';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';

export type OwnProps = {
  isOpen: boolean;
  searchPlaceholder: string;
  filter?: ApiChatType[];
  loadMore?: NoneToVoidFunction;
  onSelectRecipient: (peerId: string, threadId?: number) => void;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
};

type StateProps = {
  currentUserId?: string;
  chatsById: Record<string, ApiChat>;
  activeListIds?: string[];
  archivedListIds?: string[];
  pinnedIds?: string[];
  contactIds?: string[];
};

const RecipientPicker: FC<OwnProps & StateProps> = ({
  isOpen,
  currentUserId,
  chatsById,
  activeListIds,
  archivedListIds,
  pinnedIds,
  contactIds,
  filter = API_CHAT_TYPES,
  searchPlaceholder,
  loadMore,
  onSelectRecipient,
  onClose,
  onCloseAnimationEnd,
}) => {
  const lang = useLang();
  const [search, setSearch] = useState('');
  const ids = useMemo(() => {
    if (!isOpen) return undefined;

    let priorityIds = pinnedIds || [];
    if (currentUserId) {
      priorityIds = unique([currentUserId, ...priorityIds]);
    }

    // No need for expensive global updates on users, so we avoid them
    const global = getGlobal();
    const usersById = global.users.byId;

    const chatIds = [
      ...(activeListIds || []),
      ...((search && archivedListIds) || []),
    ].filter((id) => {
      const chat = chatsById[id];
      const user = usersById[id];
      if (user && isDeletedUser(user)) return false;

      return chat && getCanPostInChat(chat, MAIN_THREAD_ID);
    });

    const sorted = sortChatIds(unique([
      ...filterChatsByName(lang, chatIds, chatsById, search, currentUserId),
      ...(contactIds && filter.includes('users') ? filterUsersByName(contactIds, usersById, search) : []),
    ]), chatsById, undefined, priorityIds);

    return filterChatIdsByType(global, sorted, filter);
  }, [pinnedIds, currentUserId, activeListIds, search, archivedListIds, lang, chatsById, contactIds, filter, isOpen]);

  const renderingIds = useCurrentOrPrev(ids, true)!;

  return (
    <ChatOrUserPicker
      isOpen={isOpen}
      chatOrUserIds={renderingIds}
      chatsById={chatsById}
      searchPlaceholder={searchPlaceholder}
      search={search}
      onSearchChange={setSearch}
      loadMore={loadMore}
      onSelectChatOrUser={onSelectRecipient}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
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
      currentUserId,
    } = global;

    return {
      chatsById,
      activeListIds: listIds.active,
      archivedListIds: listIds.archived,
      pinnedIds: orderedPinnedIds.active,
      contactIds: global.contactList?.userIds,
      currentUserId,
    };
  },
)(RecipientPicker));
