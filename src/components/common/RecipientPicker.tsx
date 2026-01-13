import { memo, useMemo, useState } from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiChatFolder, ApiChatType } from '../../api/types';
import type { ThreadId } from '../../types';

import { ALL_FOLDER_ID, API_CHAT_TYPES } from '../../config';
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
import { selectCurrentLimit } from '../../global/selectors/limits';
import { unique } from '../../util/iteratees';
import sortChatIds from './helpers/sortChatIds';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import { useFolderManagerForOrderedIds } from '../../hooks/useFolderManager';
import useFolderTabs from '../../hooks/useFolderTabs';
import useLastCallback from '../../hooks/useLastCallback';

import TabList from '../ui/TabList';
import ChatOrUserPicker from './pickers/ChatOrUserPicker';

export type OwnProps = {
  isOpen: boolean;
  searchPlaceholder: string;
  className?: string;
  filter?: readonly ApiChatType[];
  isLowStackPriority?: boolean;
  isForwarding?: boolean;
  withFolders?: boolean;
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
  chatFoldersById: Record<number, ApiChatFolder>;
  orderedFolderIds?: number[];
  maxFolders: number;
};

const RecipientPicker = ({
  isOpen,
  currentUserId,
  activeListIds,
  archivedListIds,
  pinnedIds,
  contactIds,
  filter = API_CHAT_TYPES,
  className,
  searchPlaceholder,
  isLowStackPriority,
  chatFoldersById,
  orderedFolderIds,
  isForwarding,
  maxFolders,
  withFolders,
  loadMore,
  onSelectRecipient,
  onClose,
  onCloseAnimationEnd,
}: OwnProps & StateProps) => {
  const { openLimitReachedModal } = getActions();
  const [search, setSearch] = useState('');

  const [activeFolderIndex, setActiveFolderIndex] = useState(0);
  const { displayedFolders, folderTabs } = useFolderTabs({
    sidebarMode: false,
    orderedFolderIds,
    chatFoldersById,
    maxFolders,
    isReadOnly: true,
  });

  const shouldRenderFolders = withFolders && folderTabs?.length && !search;
  const displayedFolderId = displayedFolders?.[activeFolderIndex]?.id || ALL_FOLDER_ID;
  const orderedChatIds = useFolderManagerForOrderedIds(displayedFolderId);

  const handleSwitchFolderIndex = useLastCallback((index: number) => {
    const newTab = folderTabs?.[index];
    if (!newTab) return;

    if (newTab.isBlocked) {
      openLimitReachedModal({
        limit: 'dialogFilters',
      });
      return;
    }

    setActiveFolderIndex(index);
  });

  const ids = useMemo(() => {
    if (!isOpen) return undefined;

    let priorityIds = pinnedIds || [];
    if (currentUserId) {
      priorityIds = unique([currentUserId, ...priorityIds]);
    }

    // No need for expensive global updates on users, so we avoid them
    const global = getGlobal();

    const allIds = shouldRenderFolders ? (orderedChatIds || []) : [
      ...(activeListIds || []),
      ...((search && archivedListIds) || []),
    ];

    const peerIds = allIds.filter((id) => {
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

    const idsWithAdditions = shouldRenderFolders ? peerIds : unique([
      ...(currentUserId ? [currentUserId] : []),
      ...peerIds,
      ...(contactIds || []),
    ]);

    const sorted = sortChatIds(
      filterPeersByQuery({
        ids: idsWithAdditions,
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
    orderedChatIds,
    shouldRenderFolders,
  ]);

  const renderingIds = useCurrentOrPrev(ids, true)!;

  const chatFolders = useMemo(() => {
    if (!shouldRenderFolders) return undefined;
    return (
      <TabList
        tabs={folderTabs}
        activeTab={activeFolderIndex}
        onSwitchTab={handleSwitchFolderIndex}
      />
    );
  }, [folderTabs, activeFolderIndex, shouldRenderFolders]);

  return (
    <ChatOrUserPicker
      isOpen={isOpen}
      className={className}
      chatOrUserIds={renderingIds}
      currentUserId={currentUserId}
      searchPlaceholder={searchPlaceholder}
      search={search}
      subheader={chatFolders}
      listActiveKey={activeFolderIndex}
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
      chatFolders: {
        byId: chatFoldersById,
        orderedIds: orderedFolderIds,
      },
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
      chatFoldersById,
      orderedFolderIds,
      maxFolders: selectCurrentLimit(global, 'dialogFilters'),
    };
  },
)(RecipientPicker));
