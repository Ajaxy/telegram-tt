import React, {
  FC, useMemo, useState, memo, useRef, useCallback,
} from '../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ApiChat, MAIN_THREAD_ID } from '../../api/types';

import {
  filterChatsByName,
  filterUsersByName,
  getCanPostInChat,
  sortChatIds,
} from '../../modules/helpers';
import { pick, unique } from '../../util/iteratees';
import useLang from '../../hooks/useLang';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';

import ChatOrUserPicker from '../common/ChatOrUserPicker';

export type OwnProps = {
  isOpen: boolean;
};

type StateProps = {
  chatsById: Record<string, ApiChat>;
  activeListIds?: string[];
  archivedListIds?: string[];
  pinnedIds?: string[];
  contactIds?: string[];
  currentUserId?: string;
};

type DispatchProps = Pick<GlobalActions, 'setForwardChatId' | 'exitForwardMode' | 'loadMoreChats'>;

const ForwardPicker: FC<OwnProps & StateProps & DispatchProps> = ({
  chatsById,
  activeListIds,
  archivedListIds,
  pinnedIds,
  contactIds,
  currentUserId,
  isOpen,
  setForwardChatId,
  exitForwardMode,
  loadMoreChats,
}) => {
  const lang = useLang();
  const [filter, setFilter] = useState('');
  // eslint-disable-next-line no-null/no-null
  const filterRef = useRef<HTMLInputElement>(null);

  const chatAndContactIds = useMemo(() => {
    if (!isOpen) {
      return undefined;
    }

    let priorityIds = pinnedIds || [];
    if (currentUserId) {
      priorityIds = unique([currentUserId, ...priorityIds]);
    }

    const chatIds = [
      ...(activeListIds || []),
      ...(archivedListIds || []),
    ].filter((id) => {
      const chat = chatsById[id];

      return chat && getCanPostInChat(chat, MAIN_THREAD_ID);
    });

    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;

    return sortChatIds(unique([
      ...filterChatsByName(lang, chatIds, chatsById, filter, currentUserId),
      ...(contactIds ? filterUsersByName(contactIds, usersById, filter) : []),
    ]), chatsById, undefined, priorityIds);
  }, [activeListIds, archivedListIds, chatsById, contactIds, currentUserId, filter, isOpen, lang, pinnedIds]);

  const handleSelectUser = useCallback((userId: string) => {
    setForwardChatId({ id: userId });
  }, [setForwardChatId]);

  const renderingChatAndContactIds = useCurrentOrPrev(chatAndContactIds)!;

  return (
    <ChatOrUserPicker
      currentUserId={currentUserId}
      isOpen={isOpen}
      chatOrUserIds={renderingChatAndContactIds}
      filterRef={filterRef}
      filterPlaceholder={lang('ForwardTo')}
      filter={filter}
      onFilterChange={setFilter}
      loadMore={loadMoreChats}
      onSelectChatOrUser={handleSelectUser}
      onClose={exitForwardMode}
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
  (setGlobal, actions): DispatchProps => pick(actions, ['setForwardChatId', 'exitForwardMode', 'loadMoreChats']),
)(ForwardPicker));
