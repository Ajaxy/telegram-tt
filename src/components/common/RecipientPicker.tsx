import type { TeactNode } from '../../lib/teact/teact';
import { memo, useCallback, useMemo, useState } from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiChatFolder, ApiChatType } from '../../api/types';
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
  filterChatIdsByType, selectCanAnimateInterface, selectChat, selectChatFullInfo, selectIsMonoforumAdmin,
  selectTopic, selectUser,
} from '../../global/selectors';
import { selectCurrentLimit } from '../../global/selectors/limits';
import buildClassName from '../../util/buildClassName';
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
import { useStateRef } from '../../hooks/useStateRef';

import TabList from '../ui/TabList';
import PeerChip from './PeerChip';
import ChatOrUserPicker, { type SearchRowRenderProps } from './pickers/ChatOrUserPicker';
import PickerRecentContacts from './pickers/PickerRecentContacts';

import styles from './RecipientPicker.module.scss';

export type OwnProps = {
  isOpen: boolean;
  title?: string;
  searchPlaceholder: string;
  className?: string;
  filter?: readonly ApiChatType[];
  isLowStackPriority?: boolean;
  isForwarding?: boolean;
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
  filter = API_CHAT_TYPES,
  title,
  className,
  searchPlaceholder,
  isLowStackPriority,
  chatFoldersById,
  orderedFolderIds,
  isForwarding,
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
  const { openLimitReachedModal } = getActions();
  const lang = useLang();

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<ChatSelectionKey[]>([]);
  const [removingIds, setRemovingIds] = useState<ChatSelectionKey[]>([]);
  const [appearingIds, setAppearingIds] = useState<ChatSelectionKey[]>([]);
  const selectedIdsRef = useStateRef(selectedIds);
  const removingIdsRef = useStateRef(removingIds);
  const appearingIdsRef = useStateRef(appearingIds);

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

  const updateSelectedIds = useLastCallback((newIds: ChatSelectionKey[], newlyAddedKey?: ChatSelectionKey) => {
    setSelectedIds(newIds);
    onSelectedIdsChange?.(newIds);

    if (newlyAddedKey && selectCanAnimateInterface(getGlobal())) {
      setAppearingIds([...appearingIdsRef.current, newlyAddedKey]);
      setTimeout(() => {
        setAppearingIds(appearingIdsRef.current.filter((key) => !areChatSelectionKeysEqual(key, newlyAddedKey)));
      }, 200);
    }
  });

  const handleRemoveSelected = useLastCallback((selectionKey: ChatSelectionKey) => {
    if (includesChatSelectionKey(removingIdsRef.current, selectionKey)) return;

    const canAnimate = selectCanAnimateInterface(getGlobal());
    if (!canAnimate) {
      const newIds = selectedIdsRef.current.filter((key) => !areChatSelectionKeysEqual(key, selectionKey));
      setSelectedIds(newIds);
      onSelectedIdsChange?.(newIds);
      return;
    }

    setRemovingIds([...removingIdsRef.current, selectionKey]);

    setTimeout(() => {
      setRemovingIds(removingIdsRef.current.filter((key) => !areChatSelectionKeysEqual(key, selectionKey)));
      const newIds = selectedIdsRef.current.filter((key) => !areChatSelectionKeysEqual(key, selectionKey));
      setSelectedIds(newIds);
      onSelectedIdsChange?.(newIds);
    }, 300);
  });

  const handleToggleSelection = useLastCallback((peerId: string, threadId?: ThreadId) => {
    const selectionKey = buildChatSelectionKey(peerId, threadId ? Number(threadId) : undefined);

    if (includesChatSelectionKey(selectedIds, selectionKey)) {
      handleRemoveSelected(selectionKey);
    } else {
      updateSelectedIds([...selectedIds, selectionKey], selectionKey);
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

    const peerIds = allIds.filter((id) => {
      if (isSystemBot(id)) return false;

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

  const renderingIds = useCurrentOrPrev(ids, true);

  const recentContactIds = useMemo(() => {
    if (!contactIds) return [];
    return contactIds.slice(0, RECENT_CONTACTS_LIMIT);
  }, [contactIds]);

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

  const renderSearchRow = useCallback((props: SearchRowRenderProps) => {
    if (!hasSelectedChips) {
      return (
        <div className="search-input-wrapper">
          <i className="icon icon-search" />
          <input
            ref={props.inputRef}
            className="search-input"
            type="text"
            dir="auto"
            placeholder={props.placeholder}
            value={props.value}
            onChange={props.onChange}
            onKeyDown={props.onKeyDown}
          />
        </div>
      );
    }

    return (
      <div className="search-row-with-chips">
        <div className="chips-and-search-scroll no-scrollbar">
          {selectedIds.map((selectionKey) => {
            const { peerId } = selectionKey;
            const chipTitle = getChipTitle(selectionKey);
            const isAppearing = includesChatSelectionKey(appearingIds, selectionKey);
            const isRemoving = includesChatSelectionKey(removingIds, selectionKey);
            const keyHash = getChatSelectionKeyHash(selectionKey);

            return (
              <div
                key={keyHash}
                className={buildClassName(
                  'picker-chip-wrapper',
                  isAppearing && 'picker-chip-appear',
                  isRemoving && 'picker-chip-disappear',
                )}
              >
                <PeerChip
                  peerId={peerId}
                  title={chipTitle}
                  size="small"
                  forceShowSelf
                  canClose
                  className="picker-chip"
                  itemClassName="picker-chip-name"
                  clickArg={selectionKey}
                  onClick={handleRemoveSelected}
                />
              </div>
            );
          })}
          <div className="inline-search">
            <i className="icon icon-search" />
            <input
              ref={props.inputRef}
              className="search-input"
              type="text"
              dir="auto"
              placeholder={props.placeholder}
              value={props.value}
              onChange={props.onChange}
              onKeyDown={props.onKeyDown}
            />
          </div>
        </div>
      </div>
    );
  }, [hasSelectedChips, selectedIds, appearingIds, removingIds]);

  const selectedPeerIds = useMemo(() => selectedIds.map((key) => key.peerId), [selectedIds]);

  const subheaderContent = useMemo(() => {
    const hasRecentContacts = recentContactIds.length > 0 && !search;
    const hasFolderTabs = shouldRenderFolders;

    if (!hasRecentContacts && !hasFolderTabs) return undefined;

    return (
      <>
        {hasRecentContacts && (
          <PickerRecentContacts
            contactIds={recentContactIds}
            currentUserId={currentUserId}
            selectedIds={isMultiSelect ? selectedPeerIds : undefined}
            className={styles.recentContacts}
            onSelect={handleSelect}
          />
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
