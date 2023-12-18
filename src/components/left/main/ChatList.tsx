import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiSession } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { FolderEditDispatch } from '../../../hooks/reducers/useFoldersReducer';
import type { SettingsScreens } from '../../../types';
import { LeftColumnContent } from '../../../types';

import {
  ALL_FOLDER_ID,
  ARCHIVE_MINIMIZED_HEIGHT,
  ARCHIVED_FOLDER_ID,
  CHAT_HEIGHT_PX,
  CHAT_LIST_SLICE,
  FRESH_AUTH_PERIOD,
} from '../../../config';
import buildClassName from '../../../util/buildClassName';
import { getOrderKey, getPinnedChatsCount } from '../../../util/folderManager';
import { getServerTime } from '../../../util/serverTime';
import { IS_APP, IS_MAC_OS } from '../../../util/windowEnvironment';

import usePeerStoriesPolling from '../../../hooks/polling/usePeerStoriesPolling';
import useTopOverscroll from '../../../hooks/scroll/useTopOverscroll';
import useDebouncedCallback from '../../../hooks/useDebouncedCallback';
import { useFolderManagerForOrderedIds } from '../../../hooks/useFolderManager';
import { useHotkeys } from '../../../hooks/useHotkeys';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import { useStorage } from '../../../hooks/useStorage';
import useOrderDiff from './hooks/useOrderDiff';

import InfiniteScroll from '../../ui/InfiniteScroll';
import Loading from '../../ui/Loading';
import Archive from './Archive';
import Chat from './Chat';
import EmptyFolder from './EmptyFolder';
import UnconfirmedSession from './UnconfirmedSession';

type OwnProps = {
  folderType: 'all' | 'archived' | 'folder';
  isInbox?: boolean;
  folderId?: number;
  isActive: boolean;
  canDisplayArchive?: boolean;
  archiveSettings: GlobalState['archiveSettings'];
  isForumPanelOpen?: boolean;
  sessions?: Record<string, ApiSession>;
  foldersDispatch: FolderEditDispatch;
  onSettingsScreenSelect: (screen: SettingsScreens) => void;
  onLeftColumnContentChange: (content: LeftColumnContent) => void;
};

const INTERSECTION_THROTTLE = 200;
const DRAG_ENTER_DEBOUNCE = 500;
const RESERVED_HOTKEYS = new Set(['9', '0']);

const ChatList: FC<OwnProps> = ({
  folderType,
  folderId,
  isInbox,
  isActive,
  isForumPanelOpen,
  canDisplayArchive,
  archiveSettings,
  sessions,
  foldersDispatch,
  onSettingsScreenSelect,
  onLeftColumnContentChange,
}) => {
  const {
    openChat,
    openNextChat,
    closeForumPanel,
    toggleStoryRibbon,
  } = getActions();

  const { doneChatIds } = useStorage();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldIgnoreDragRef = useRef(false);
  const [unconfirmedSessionHeight, setUnconfirmedSessionHeight] = useState(0);

  const isArchived = folderType === 'archived';
  const isAllFolder = folderType === 'all';
  const resolvedFolderId = (
    isAllFolder ? ALL_FOLDER_ID : isArchived ? ARCHIVED_FOLDER_ID : folderId!
  );

  const shouldDisplayArchive = isAllFolder && canDisplayArchive;

  const orderedIdsAll = useFolderManagerForOrderedIds(resolvedFolderId);
  usePeerStoriesPolling(orderedIdsAll);
  const orderedIds = isInbox
    ? orderedIdsAll?.filter((orderedId) => !doneChatIds.includes(orderedId))
    : orderedIdsAll;

  const chatsHeight = (orderedIds?.length || 0) * CHAT_HEIGHT_PX;
  const archiveHeight = shouldDisplayArchive
    ? archiveSettings.isMinimized ? ARCHIVE_MINIMIZED_HEIGHT : CHAT_HEIGHT_PX : 0;

  const { orderDiffById, getAnimationType } = useOrderDiff(orderedIds);

  const [viewportIds, getMore] = useInfiniteScroll(undefined, orderedIds, undefined, CHAT_LIST_SLICE);

  const shouldShowUnconfirmedSessions = useMemo(() => {
    const sessionsArray = Object.values(sessions || {});
    const current = sessionsArray.find((session) => session.isCurrent);
    if (!current || getServerTime() - current.dateCreated < FRESH_AUTH_PERIOD) return false;

    return isAllFolder && sessionsArray.some((session) => session.isUnconfirmed);
  }, [isAllFolder, sessions]);

  useEffect(() => {
    if (!shouldShowUnconfirmedSessions) setUnconfirmedSessionHeight(0);
  }, [shouldShowUnconfirmedSessions]);

  // Support <Alt>+<Up/Down> to navigate between chats
  useHotkeys(isActive && orderedIds?.length ? {
    'Alt+J': (e: KeyboardEvent) => {
      e.preventDefault();
      openNextChat({ targetIndexDelta: -1, orderedIds });
    },
    'Alt+K': (e: KeyboardEvent) => {
      e.preventDefault();
      openNextChat({ targetIndexDelta: 1, orderedIds });
    },
  } : undefined);

  // Support <Cmd>+<Digit> to navigate between chats
  useEffect(() => {
    if (!isActive || !orderedIds || !IS_APP) {
      return undefined;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (((IS_MAC_OS && e.metaKey) || (!IS_MAC_OS && e.ctrlKey)) && e.code.startsWith('Digit')) {
        const [, digit] = e.code.match(/Digit(\d)/) || [];
        if (!digit || RESERVED_HOTKEYS.has(digit)) return;

        const isArchiveInList = shouldDisplayArchive && !archiveSettings.isMinimized;

        const shift = isArchiveInList ? -1 : 0;
        const position = Number(digit) + shift - 1;

        if (isArchiveInList && position === -1) {
          onLeftColumnContentChange(LeftColumnContent.Archived);
          return;
        }

        if (position > orderedIds!.length - 1) return;

        openChat({ id: orderedIds![position], shouldReplaceHistory: true });
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [archiveSettings, isActive, onLeftColumnContentChange, openChat, openNextChat, orderedIds, shouldDisplayArchive]);

  const { observe } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  });

  const handleArchivedClick = useLastCallback(() => {
    onLeftColumnContentChange(LeftColumnContent.Archived);
    closeForumPanel();
  });

  const handleArchivedDragEnter = useLastCallback(() => {
    if (shouldIgnoreDragRef.current) {
      shouldIgnoreDragRef.current = false;
      return;
    }
    handleArchivedClick();
  });

  const handleDragEnter = useDebouncedCallback((chatId: string) => {
    if (shouldIgnoreDragRef.current) {
      shouldIgnoreDragRef.current = false;
      return;
    }
    openChat({ id: chatId, shouldReplaceHistory: true });
  }, [openChat], DRAG_ENTER_DEBOUNCE, true);

  const handleDragLeave = useLastCallback((e: React.DragEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < rect.width || y < rect.y) return;
    shouldIgnoreDragRef.current = true;
  });

  const handleShowStoryRibbon = useLastCallback(() => {
    toggleStoryRibbon({ isShown: true, isArchived });
  });

  const handleHideStoryRibbon = useLastCallback(() => {
    toggleStoryRibbon({ isShown: false, isArchived });
  });

  const renderedOverflowTrigger = useTopOverscroll(containerRef, handleShowStoryRibbon, handleHideStoryRibbon);

  function renderChats() {
    const viewportOffset = orderedIds!.indexOf(viewportIds![0]);

    const pinnedCount = getPinnedChatsCount(resolvedFolderId) || 0;

    return viewportIds!.map((id, i) => {
      const isPinned = viewportOffset + i < pinnedCount;
      const offsetTop = unconfirmedSessionHeight + archiveHeight + (viewportOffset + i) * CHAT_HEIGHT_PX;
      const isDone = doneChatIds.includes(id);

      return (
        <Chat
          key={id}
          teactOrderKey={isPinned ? i : getOrderKey(id)}
          chatId={id}
          isPinned={isPinned}
          isDone={isDone}
          folderId={folderId}
          isInbox={isInbox}
          animationType={getAnimationType(id)}
          orderDiff={orderDiffById[id]}
          offsetTop={offsetTop}
          observeIntersection={observe}
          onDragEnter={handleDragEnter}
        />
      );
    });
  }

  return (
    <InfiniteScroll
      className={buildClassName('chat-list custom-scroll', isForumPanelOpen && 'forum-panel-open')}
      ref={containerRef}
      items={viewportIds}
      itemSelector=".ListItem:not(.chat-item-archive)"
      preloadBackwards={CHAT_LIST_SLICE}
      withAbsolutePositioning
      beforeChildren={renderedOverflowTrigger}
      maxHeight={chatsHeight + archiveHeight + unconfirmedSessionHeight}
      onLoadMore={getMore}
      onDragLeave={handleDragLeave}
    >
      {shouldShowUnconfirmedSessions && (
        <UnconfirmedSession
          key="unconfirmed"
          sessions={sessions!}
          onHeightChange={setUnconfirmedSessionHeight}
        />
      )}
      {shouldDisplayArchive && (
        <Archive
          key="archive"
          archiveSettings={archiveSettings}
          onClick={handleArchivedClick}
          onDragEnter={handleArchivedDragEnter}
        />
      )}
      {viewportIds?.length ? (
        renderChats()
      ) : (viewportIds && !viewportIds.length) || isAllFolder ? ( // TODO: improve tempfix for allFolder
        (
          <EmptyFolder
            folderId={folderId}
            folderType={folderType}
            isInbox={isInbox}
            foldersDispatch={foldersDispatch}
            onSettingsScreenSelect={onSettingsScreenSelect}
          />
        )
      ) : (
        <Loading key="loading" />
      )}
    </InfiniteScroll>
  );
};

export default memo(ChatList);
