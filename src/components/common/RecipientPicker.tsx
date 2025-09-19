import type { FC } from '../../lib/teact/teact';
import { memo, useMemo, useState } from '../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../global';

import type { ApiChatType } from '../../api/types';
import type { ThreadId } from '../../types';

import { API_CHAT_TYPES } from '../../config';
import {
  getCanPostInChat,
  getHasAdminRight,
  isChatChannel,
  isDeletedUser,
} from '../../global/helpers';
import { filterPeersByQuery } from '../../global/helpers/peers';
import {
  filterChatIdsByType, selectChat, selectChatFullInfo, selectIsMonoforumAdmin, selectUser,
} from '../../global/selectors';
import { unique } from '../../util/iteratees';
import sortChatIds from './helpers/sortChatIds';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';

import ChatOrUserPicker from './pickers/ChatOrUserPicker';

export type OwnProps = {
  isOpen: boolean;
  searchPlaceholder: string;
  className?: string;
  filter?: ApiChatType[];
  loadMore?: NoneToVoidFunction;
  onSelectRecipient: (peerId: string, threadId?: ThreadId) => void;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
  isLowStackPriority?: boolean;
  isForwarding?: boolean;
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
  isLowStackPriority,
  isForwarding,
}) => {
  const [search, setSearch] = useState('');
  const ids = useMemo(() => {
    if (!isOpen) return undefined;

    let priorityIds = pinnedIds || [];
    if (currentUserId) {
      priorityIds = unique([currentUserId, ...priorityIds]);
    }

    // No need for expensive global updates on users, so we avoid them
    const global = getGlobal();

    const peerIds = [
      ...(activeListIds || []),
      ...((search && archivedListIds) || []),
    ].filter((id) => {
      const chat = selectChat(global, id);
      const user = selectUser(global, id);
      const hasAdminRights = chat && getHasAdminRight(chat, 'postMessages');
      const isChannel = chat && isChatChannel(chat);
      if (isForwarding && isChannel && !hasAdminRights) return false;
      if (user && !isDeletedUser(user)) return true;

      if (!chat) return false;

      if (chat.isMonoforum && selectIsMonoforumAdmin(global, id)) {
        return false;
      }

      const chatFullInfo = selectChatFullInfo(global, id);
      // TODO: Handle bulk check with API call
      return !chatFullInfo || getCanPostInChat(chat, undefined, undefined, chatFullInfo);
    });

    const sorted = sortChatIds(
      filterPeersByQuery({
        ids: unique([
          ...(currentUserId ? [currentUserId] : []),
          ...peerIds,
          ...(contactIds || []),
        ]),
        query: search,
      }),
      undefined,
      priorityIds,
      currentUserId,
    );

    return filterChatIdsByType(global, sorted, filter);
  }, [
    isOpen,
    pinnedIds,
    currentUserId,
    activeListIds,
    search,
    archivedListIds,
    contactIds,
    filter,
    isForwarding,
  ]);

  const renderingIds = useCurrentOrPrev(ids, true)!;

  return (
    <ChatOrUserPicker
      isOpen={isOpen}
      className={className}
      chatOrUserIds={renderingIds}
      currentUserId={currentUserId}
      searchPlaceholder={searchPlaceholder}
      search={search}
      onSearchChange={setSearch}
      loadMore={loadMore}
      onSelectChatOrUser={onSelectRecipient}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
      isLowStackPriority={isLowStackPriority}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
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
