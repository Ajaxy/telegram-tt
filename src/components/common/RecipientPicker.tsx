import type { FC } from '../../lib/teact/teact';
import React, { memo, useMemo, useState } from '../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../global';

import type { ApiChatType } from '../../api/types';
import type { ThreadId } from '../../types';
import { MAIN_THREAD_ID } from '../../api/types';

import { API_CHAT_TYPES } from '../../config';
import {
  filterChatsByName,
  filterUsersByName,
  getCanPostInChat,
  isDeletedUser,
} from '../../global/helpers';
import { filterChatIdsByType } from '../../global/selectors';
import { unique } from '../../util/iteratees';
import sortChatIds from './helpers/sortChatIds';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useLang from '../../hooks/useLang';

import ChatOrUserPicker from './ChatOrUserPicker';

export type OwnProps = {
  isOpen: boolean;
  searchPlaceholder: string;
  className?: string;
  filter?: ApiChatType[];
  loadMore?: NoneToVoidFunction;
  onSelectRecipient: (peerId: string, threadId?: ThreadId) => void;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
};

type StateProps = {
  currentUserId?: string;
  activeListIds?: string[];
  archivedListIds?: string[];
  pinnedIds?: string[];
  contactIds?: string[];
};

const RecipientPicker: FC<OwnProps & StateProps> = ({
  isOpen,
  currentUserId,
  activeListIds,
  archivedListIds,
  pinnedIds,
  contactIds,
  filter = API_CHAT_TYPES,
  className,
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
    const chatsById = global.chats.byId;
    const chatFullInfoById = global.chats.fullInfoById;

    const chatIds = [
      ...(activeListIds || []),
      ...((search && archivedListIds) || []),
    ].filter((id) => {
      const chat = chatsById[id];
      const user = usersById[id];
      if (user && isDeletedUser(user)) return false;

      return chat && getCanPostInChat(chat, MAIN_THREAD_ID, undefined, chatFullInfoById[id]);
    });

    const sorted = sortChatIds(unique([
      ...filterChatsByName(lang, chatIds, chatsById, search, currentUserId),
      ...(contactIds && filter.includes('users') ? filterUsersByName(contactIds, usersById, search) : []),
    ]), undefined, priorityIds);

    return filterChatIdsByType(global, sorted, filter);
  }, [pinnedIds, currentUserId, activeListIds, search, archivedListIds, lang, contactIds, filter, isOpen]);

  const renderingIds = useCurrentOrPrev(ids, true)!;

  return (
    <ChatOrUserPicker
      isOpen={isOpen}
      className={className}
      chatOrUserIds={renderingIds}
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
        listIds,
        orderedPinnedIds,
      },
      currentUserId,
    } = global;

    return {
      activeListIds: listIds.active,
      archivedListIds: listIds.archived,
      pinnedIds: orderedPinnedIds.active,
      contactIds: global.contactList?.userIds,
      currentUserId,
    };
  },
)(RecipientPicker));
