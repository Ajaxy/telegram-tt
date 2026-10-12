import type { TeactNode } from '../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiChatFolder, ApiChatType } from '../../api/types';
import type { GlobalState } from '../../global/types';
import type { ThreadId } from '../../types';

import { ALL_FOLDER_ID, API_CHAT_TYPES } from '../../config';
import {
  getCanPostInChat,
  getChatTitle,
  getHasAdminRight,
  isChatChannel,
  isDeletedUser,
  isSystemBot,
} from '../../global/helpers';
import { filterPeersByQuery } from '../../global/helpers/peers';
import {
  filterChatIdsByType, selectCanInviteToChat, selectChat, selectChatFullInfo,
  selectIsMonoforumAdmin, selectTopic, selectUser,
} from '../../global/selectors';
import { selectCurrentLimit } from '../../global/selectors/limits';
import { unique } from '../../util/iteratees';
import {
  areChatSelectionKeysEqual,
  buildChatSelectionKey,
  type ChatSelectionKey,
  getChatSelectionKeyHash,
  includesChatSelectionKey,
} from '../../util/keys/chatSelectionKey';
import sortChatIds from './helpers/sortChatIds';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import { useFolderManagerForOrderedIds } from '../../hooks/useFolderManager';
import useFolderTabs from '../../hooks/useFolderTabs';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Island from '../gili/layout/Island';
import TabList from '../ui/TabList';
import ListTopPeers from './ListTopPeers';
import ChatOrUserPicker, { type SearchRowRenderProps } from './pickers/ChatOrUserPicker';
import PickerSearchField, { type PickerSearchChip } from './pickers/PickerSearchField';

import styles from './RecipientPicker.module.scss';

export type OwnProps = {
  isOpen: boolean;
  title?: string;
  searchPlaceholder: string;
  className?: string;
  filter?: readonly ApiChatType[];
  isLowStackPriority?: boolean;
  isNativeDialog?: boolean;
  isForwarding?: boolean;
  shouldFilterInviteable?: boolean;
  isMultiSelect?: boolean;
  withFolders?: boolean;
  footer?: TeactNode;
  viewportFooter?: TeactNode;
  loadMore?: NoneToVoidFunction;
  onSelectRecipient: (peerId: string, threadId?: ThreadId) => void;
  onSelectedIdsChange?: (ids: ChatSelectionKey[]) => void;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
};

type StateProps = {
  currentUserId?: string;
  activeListIds?: string[];
  archivedListIds?: string[];
  pinnedIds?: string[];
  contactIds?: string[];
  topPeerIds?: string[];
  chatFoldersById: Record<number, ApiChatFolder>;
  orderedFolderIds?: number[];
  maxFolders: number;
};

const RECENT_CONTACTS_LIMIT = 15;

const RecipientPicker = ({
  isOpen,
  currentUserId,
  activeListIds,
  archivedListIds,
  pinnedIds,
  contactIds,
  topPeerIds,
  filter = API_CHAT_TYPES,
  title,
  className,
  searchPlaceholder,
  isLowStackPriority,
  isNativeDialog,
  chatFoldersById,
  orderedFolderIds,
  isForwarding,
  shouldFilterInviteable,
  isMultiSelect,
  maxFolders,
  withFolders,
  footer,
  viewportFooter,
  loadMore,
  onSelectRecipient,
  onSelectedIdsChange,
  onClose,
  onCloseAnimationEnd,
}: OwnProps & StateProps) => {
  const { openLimitReachedModal, loadTopPeers } = getActions();
  const lang = useLang();

  useEffect(() => {
    if (isOpen) {
      loadTopPeers({ category: 'correspondents' });
    }
  }, [isOpen, loadTopPeers]);

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<ChatSelectionKey[]>([]);

  const [activeFolderIndex, setActiveFolderIndex] = useState(0);
  const { displayedFolders, folderTabs } = useFolderTabs({
    sidebarMode: false,
    orderedFolderIds,
    chatFoldersById,
    maxFolders,
    noEmoticons: true,
    isReadOnly: true,
  });

  const shouldRenderFolders = withFolders && folderTabs && folderTabs.length > 1 && !search;
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

  const updateSelectedIds = useLastCallback((newIds: ChatSelectionKey[]) => {
    setSelectedIds(newIds);
    onSelectedIdsChange?.(newIds);
  });

  const handleRemoveSelected = useLastCallback((selectionKey: ChatSelectionKey) => {
    updateSelectedIds(selectedIds.filter((key) => !areChatSelectionKeysEqual(key, selectionKey)));
  });

  const handleChipClick = useLastCallback((keyHash: string) => {
    const selectionKey = selectedIds.find((key) => getChatSelectionKeyHash(key) === keyHash);
    if (selectionKey) {
      handleRemoveSelected(selectionKey);
    }
  });

  const handleToggleSelection = useLastCallback((peerId: string, threadId?: ThreadId) => {
    const selectionKey = buildChatSelectionKey(peerId, threadId ? Number(threadId) : undefined);

    if (includesChatSelectionKey(selectedIds, selectionKey)) {
      handleRemoveSelected(selectionKey);
    } else {
      updateSelectedIds([...selectedIds, selectionKey]);
    }
  });

  const handleSelect = useLastCallback((peerId: string, threadId?: ThreadId) => {
    if (isMultiSelect) {
      handleToggleSelection(peerId, threadId);
    } else {
      onSelectRecipient(peerId, threadId);
    }
  });

  const ids = useMemo(() => {
    if (!isOpen) return [];

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

    const peerIds = allIds.filter((id) => getIsRecipientAllowed(global, id, isForwarding, shouldFilterInviteable));

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
    shouldFilterInviteable,
    orderedChatIds,
    shouldRenderFolders,
  ]);

  const renderingIds = useCurrentOrPrev(ids, true);

  const recentContactIds = useMemo(() => {
    const global = getGlobal();
    const source = topPeerIds?.length ? topPeerIds : (contactIds || []);
    const allowed = source.filter((id) => getIsRecipientAllowed(global, id, isForwarding, shouldFilterInviteable));
    return filterChatIdsByType(global, allowed, filter).slice(0, RECENT_CONTACTS_LIMIT);
  }, [topPeerIds, contactIds, filter, isForwarding, shouldFilterInviteable]);

  const hasSelectedChips = isMultiSelect && selectedIds.length > 0;

  const getChipTitle = useLastCallback((selectionKey: ChatSelectionKey): string | undefined => {
    const { peerId, topicId } = selectionKey;
    if (!topicId) return undefined;

    const global = getGlobal();
    const topic = selectTopic(global, peerId, topicId);
    const chat = selectChat(global, peerId);

    if (!topic || !chat) return undefined;

    const chatTitle = getChatTitle(lang, chat);
    return `${topic.title} • ${chatTitle}`;
  });

  const searchChips = useMemo(() => {
    if (!hasSelectedChips) return undefined;
    return selectedIds.map((selectionKey): PickerSearchChip => ({
      key: getChatSelectionKeyHash(selectionKey),
      peerId: selectionKey.peerId,
      title: getChipTitle(selectionKey),
      canClose: true,
    }));
  }, [hasSelectedChips, selectedIds]);

  const renderSearchRow = useCallback((props: SearchRowRenderProps) => {
    return (
      <PickerSearchField
        inputRef={props.inputRef}
        value={props.value}
        placeholder={props.placeholder}
        chips={searchChips}
        onChange={props.onChange}
        onKeyDown={props.onKeyDown}
        onChipClick={handleChipClick}
      />
    );
  }, [searchChips]);

  const selectedPeerIds = useMemo(() => selectedIds.map((key) => key.peerId), [selectedIds]);

  const subheaderContent = useMemo(() => {
    const hasRecentContacts = recentContactIds.length > 0 && !search;
    const hasFolderTabs = shouldRenderFolders;

    if (!hasRecentContacts && !hasFolderTabs) return undefined;

    return (
      <>
        {hasRecentContacts && (
          <Island className={styles.recentContacts}>
            <ListTopPeers
              peerIds={recentContactIds}
              currentUserId={currentUserId}
              selectedIds={isMultiSelect ? selectedPeerIds : undefined}
              onPeerClick={handleSelect}
            />
          </Island>
        )}
        {Boolean(hasFolderTabs) && folderTabs && (
          <TabList
            tabs={folderTabs}
            activeTab={activeFolderIndex}
            onSwitchTab={handleSwitchFolderIndex}
          />
        )}
      </>
    );
  }, [
    recentContactIds,
    search,
    shouldRenderFolders,
    currentUserId,
    handleSelect,
    isMultiSelect,
    selectedPeerIds,
    folderTabs,
    activeFolderIndex,
    handleSwitchFolderIndex,
  ]);

  return (
    <ChatOrUserPicker
      isOpen={isOpen}
      className={className}
      chatOrUserIds={renderingIds}
      currentUserId={currentUserId}
      title={title}
      searchPlaceholder={searchPlaceholder}
      search={search}
      renderSearchRow={renderSearchRow}
      subheader={subheaderContent}
      footer={footer}
      viewportFooter={viewportFooter}
      listActiveKey={activeFolderIndex}
      selectedIds={isMultiSelect ? selectedIds : undefined}
      onSearchChange={setSearch}
      loadMore={loadMore}
      onSelectChatOrUser={handleSelect}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
      isLowStackPriority={isLowStackPriority}
      isNativeDialog={isNativeDialog}
    />
  );
};

function getIsRecipientAllowed(
  global: GlobalState,
  id: string,
  isForwarding?: boolean,
  shouldFilterInviteable?: boolean,
) {
  if (isSystemBot(id)) return false;

  const chat = selectChat(global, id);
  const user = selectUser(global, id);
  const hasAdminRights = chat && getHasAdminRight(chat, 'postMessages');
  const isChannel = chat && isChatChannel(chat);
  if (isForwarding && isChannel && !hasAdminRights) return false;
  if (user) return !isDeletedUser(user);

  if (!chat) return false;

  if (chat.isMonoforum && selectIsMonoforumAdmin(global, id)) {
    return false;
  }

  if (shouldFilterInviteable) {
    return selectCanInviteToChat(global, id);
  }

  const chatFullInfo = selectChatFullInfo(global, id);
  // TODO: Handle bulk check with API call
  return !chatFullInfo || getCanPostInChat(chat, undefined, undefined, chatFullInfo);
}

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
      topPeerIds: global.topPeerCategories.correspondents?.peerIds,
      currentUserId,
      chatFoldersById,
      orderedFolderIds,
      maxFolders: selectCurrentLimit(global, 'dialogFilters'),
    };
  },
)(RecipientPicker));
