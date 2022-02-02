import React, {
  FC, useMemo, useState, memo, useRef, useCallback, useEffect,
} from '../../lib/teact/teact';
import { getDispatch, getGlobal, withGlobal } from '../../lib/teact/teactn';

import { ApiChat, MAIN_THREAD_ID } from '../../api/types';

import {
  filterChatsByName,
  filterUsersByName,
  getCanPostInChat,
  sortChatIds,
} from '../../modules/helpers';
import { unique } from '../../util/iteratees';
import useLang from '../../hooks/useLang';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useFlag from '../../hooks/useFlag';

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

const ForwardPicker: FC<OwnProps & StateProps> = ({
  chatsById,
  activeListIds,
  archivedListIds,
  pinnedIds,
  contactIds,
  currentUserId,
  isOpen,
}) => {
  const {
    setForwardChatId,
    exitForwardMode,
    loadMoreChats,
  } = getDispatch();

  const lang = useLang();
  const [filter, setFilter] = useState('');
  // eslint-disable-next-line no-null/no-null
  const filterRef = useRef<HTMLInputElement>(null);

  const [isShown, markIsShown, unmarkIsShown] = useFlag();
  useEffect(() => {
    if (isOpen) {
      markIsShown();
    }
  }, [isOpen, markIsShown]);

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

  const renderingChatAndContactIds = useCurrentOrPrev(chatAndContactIds, true)!;

  if (!isOpen && !isShown) {
    return undefined;
  }

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
      onCloseAnimationEnd={unmarkIsShown}
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
)(ForwardPicker));
