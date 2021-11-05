import React, {
  FC, useMemo, useState, memo, useRef, useCallback,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ApiChat, MAIN_THREAD_ID } from '../../api/types';

import { getCanPostInChat, getChatTitle, sortChatIds } from '../../modules/helpers';
import searchWords from '../../util/searchWords';
import { pick, unique } from '../../util/iteratees';
import useLang from '../../hooks/useLang';

import ChatOrUserPicker from '../common/ChatOrUserPicker';

export type OwnProps = {
  isOpen: boolean;
};

type StateProps = {
  chatsById: Record<string, ApiChat>;
  pinnedIds?: string[];
  activeListIds?: string[];
  archivedListIds?: string[];
  orderedPinnedIds?: string[];
  currentUserId?: string;
};

type DispatchProps = Pick<GlobalActions, 'setForwardChatId' | 'exitForwardMode' | 'loadMoreChats'>;

const ForwardPicker: FC<OwnProps & StateProps & DispatchProps> = ({
  chatsById,
  pinnedIds,
  activeListIds,
  archivedListIds,
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

  const chatIds = useMemo(() => {
    const listIds = [
      ...(activeListIds || []),
      ...(archivedListIds || []),
    ];

    let priorityIds = pinnedIds || [];
    if (currentUserId) {
      priorityIds = unique([currentUserId, ...priorityIds]);
    }

    return sortChatIds([
      ...listIds.filter((id) => {
        const chat = chatsById[id];
        if (!chat) {
          return true;
        }

        if (!getCanPostInChat(chat, MAIN_THREAD_ID)) {
          return false;
        }

        if (!filter) {
          return true;
        }

        return searchWords(getChatTitle(lang, chatsById[id], undefined, id === currentUserId), filter);
      }),
    ], chatsById, undefined, priorityIds);
  }, [activeListIds, archivedListIds, chatsById, currentUserId, filter, lang, pinnedIds]);

  const handleSelectUser = useCallback((userId: string) => {
    setForwardChatId({ id: userId });
  }, [setForwardChatId]);

  return (
    <ChatOrUserPicker
      currentUserId={currentUserId}
      isOpen={isOpen}
      chatOrUserIds={chatIds}
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
      pinnedIds: orderedPinnedIds.active,
      activeListIds: listIds.active,
      archivedListIds: listIds.archived,
      currentUserId,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['setForwardChatId', 'exitForwardMode', 'loadMoreChats']),
)(ForwardPicker));
