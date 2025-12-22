import { memo, useEffect, useMemo, useRef, useState } from '@teact';
import { getActions } from '../../../global';

import type { GlobalState } from '../../../global/types';
import type { FolderEditDispatch } from '../../../hooks/reducers/useFoldersReducer';
import { LeftColumnContent } from '../../../types';

import {
  ALL_FOLDER_ID,
  ARCHIVE_MINIMIZED_HEIGHT,
  ARCHIVED_FOLDER_ID,
  CHAT_HEIGHT_PX,
  CHAT_LIST_SLICE,
  SAVED_FOLDER_ID,
} from '../../../config';
import { IS_APP, IS_MAC_OS } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { onDragEnter, onDragLeave } from '../../../util/dragNDropHandlers';
import { getOrderKey, getPinnedChatsCount } from '../../../util/folderManager';
import { ARCHIVE_ANIMATION_ID } from './hooks';

import usePeerStoriesPolling from '../../../hooks/polling/usePeerStoriesPolling';
import useTopOverscroll from '../../../hooks/scroll/useTopOverscroll';
import { useFolderManagerForOrderedIds } from '../../../hooks/useFolderManager';
import { useHotkeys } from '../../../hooks/useHotkeys';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useOrderDiff from './hooks/useOrderDiff';

import InfiniteScroll from '../../ui/InfiniteScroll';
import Loading from '../../ui/Loading';
import Archive from './Archive';
import Chat from './Chat';
import EmptyFolder from './EmptyFolder';
import ChatListPanes from './panes/ChatListPanes';

type OwnProps = {
  className?: string;
  folderType: 'all' | 'archived' | 'saved' | 'folder';
  folderId?: number;
  isActive: boolean;
  canDisplayArchive?: boolean;
  archiveSettings?: GlobalState['archiveSettings'];
  isForumPanelOpen?: boolean;
  isMainList?: boolean;
  withTags?: boolean;
  isFoldersSidebarShown?: boolean;
  isStoryRibbonShown?: boolean;
  foldersDispatch?: FolderEditDispatch;
};

const INTERSECTION_THROTTLE = 200;
const RESERVED_HOTKEYS = new Set(['9', '0']);

const ChatList = ({
  className,
  folderType,
  folderId,
  isActive,
  isForumPanelOpen,
  canDisplayArchive,
  archiveSettings,
  isMainList,
  withTags,
  isFoldersSidebarShown,
  isStoryRibbonShown,
  foldersDispatch,
}: OwnProps) => {
  const {
    openChat,
    openNextChat,
    closeForumPanel,
    toggleStoryRibbon,
    openLeftColumnContent,
  } = getActions();
  const containerRef = useRef<HTMLDivElement>();
  const [panesHeight, setPanesHeight] = useState(0);

  const isArchived = folderType === 'archived';
  const isAllFolder = folderType === 'all';
  const isSaved = folderType === 'saved';
  const resolvedFolderId = (
    isAllFolder ? ALL_FOLDER_ID : isArchived ? ARCHIVED_FOLDER_ID : isSaved ? SAVED_FOLDER_ID : folderId!
  );

  const shouldDisplayArchive = isAllFolder && canDisplayArchive && archiveSettings;

  const orderedIds = useFolderManagerForOrderedIds(resolvedFolderId);
  usePeerStoriesPolling(orderedIds);

  const chatsHeight = (orderedIds?.length || 0) * CHAT_HEIGHT_PX;
  const archiveHeight = shouldDisplayArchive
    ? archiveSettings?.isMinimized ? ARCHIVE_MINIMIZED_HEIGHT : CHAT_HEIGHT_PX : 0;

  const {
    orderDiffById, shiftDiff, getAnimationType, onReorderAnimationEnd: onReorderAnimationEnd,
  } = useOrderDiff(orderedIds, panesHeight);

  const [viewportIds, getMore] = useInfiniteScroll(undefined, orderedIds, undefined, CHAT_LIST_SLICE);

  // Support <Alt>+<Up/Down> to navigate between chats
  useHotkeys(useMemo(() => (isActive && orderedIds?.length ? {
    'Alt+ArrowUp': (e: KeyboardEvent) => {
      e.preventDefault();
      openNextChat({ targetIndexDelta: -1, orderedIds });
    },
    'Alt+ArrowDown': (e: KeyboardEvent) => {
      e.preventDefault();
      openNextChat({ targetIndexDelta: 1, orderedIds });
    },
  } : undefined), [isActive, orderedIds]));

  // Support <Cmd>+<Digit> to navigate between chats
  useEffect(() => {
    if (!isActive || isSaved || !orderedIds || !IS_APP) {
      return undefined;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (((IS_MAC_OS && e.metaKey) || (!IS_MAC_OS && e.ctrlKey)) && e.code.startsWith('Digit')) {
        const [, digit] = e.code.match(/Digit(\d)/) || [];
        if (!digit || RESERVED_HOTKEYS.has(digit)) return;

        const isArchiveInList = shouldDisplayArchive && archiveSettings && !archiveSettings.isMinimized;

        const shift = isArchiveInList ? -1 : 0;
        const position = Number(digit) + shift - 1;

        if (isArchiveInList && position === -1) {
          if (isMainList) openLeftColumnContent({ contentKey: LeftColumnContent.Archived });
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
  }, [
    archiveSettings, isSaved, isActive, openChat, openNextChat, orderedIds, shouldDisplayArchive, isMainList,
  ]);

  const { observe } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  });

  const handleArchivedClick = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.Archived });
    closeForumPanel();
  });

  const handleShowStoryRibbon = useLastCallback(() => {
    toggleStoryRibbon({ isShown: true, isArchived });
  });

  const handleHideStoryRibbon = useLastCallback(() => {
    toggleStoryRibbon({ isShown: false, isArchived });
  });

  const handleArchivedDragEnter = useLastCallback(() => {
    onDragEnter(() => {
      handleArchivedClick();
    });
  });

  const handleChatDragEnter = useLastCallback((chatId: string) => {
    onDragEnter(() => {
      openChat({ id: chatId, shouldReplaceHistory: true });
    });
  });

  useTopOverscroll({
    containerRef,
    onOverscroll: handleShowStoryRibbon,
    onReset: handleHideStoryRibbon,
    isDisabled: isSaved,
    isOverscrolled: isStoryRibbonShown,
  });

  function renderChats() {
    const viewportOffset = orderedIds!.indexOf(viewportIds![0]);

    const pinnedCount = getPinnedChatsCount(resolvedFolderId) || 0;

    return viewportIds!.map((id, i) => {
      const isPinned = viewportOffset + i < pinnedCount;
      const offsetTop = panesHeight + archiveHeight + (viewportOffset + i) * CHAT_HEIGHT_PX;

      return (
        <Chat
          key={id}
          teactOrderKey={isPinned ? i : getOrderKey(id, isSaved)}
          chatId={id}
          isPinned={isPinned}
          folderId={folderId}
          isSavedDialog={isSaved}
          animationType={getAnimationType(id)}
          orderDiff={orderDiffById[id]}
          shiftDiff={shiftDiff}
          onReorderAnimationEnd={onReorderAnimationEnd}
          offsetTop={offsetTop}
          observeIntersection={observe}
          onDragEnter={handleChatDragEnter}
          onDragLeave={onDragLeave}
          withTags={withTags}
          isFoldersSidebarShown={isFoldersSidebarShown}
        />
      );
    });
  }

  return (
    <InfiniteScroll
      className={buildClassName('chat-list custom-scroll', isForumPanelOpen && 'forum-panel-open', className)}
      ref={containerRef}
      items={viewportIds}
      itemSelector=".ListItem:not(.chat-item-archive)"
      preloadBackwards={CHAT_LIST_SLICE}
      withAbsolutePositioning
      maxHeight={chatsHeight + archiveHeight + panesHeight}
      onLoadMore={getMore}
    >
      {isAllFolder && <ChatListPanes key="panes" onHeightChange={setPanesHeight} />}
      {shouldDisplayArchive && (
        <Archive
          key="archive"
          archiveSettings={archiveSettings}
          onClick={handleArchivedClick}
          onDragEnter={handleArchivedDragEnter}
          animationType={getAnimationType(ARCHIVE_ANIMATION_ID)}
          offsetTop={panesHeight}
          isFoldersSidebarShown={isFoldersSidebarShown}
        />
      )}
      {viewportIds?.length ? (
        renderChats()
      ) : viewportIds && !viewportIds.length && !isSaved ? (
        (
          <EmptyFolder
            folderId={folderId}
            folderType={folderType}
            foldersDispatch={foldersDispatch!}
          />
        )
      ) : (
        <Loading key="loading" />
      )}
    </InfiniteScroll>
  );
};

export default memo(ChatList);
