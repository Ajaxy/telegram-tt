import React, {
  memo, useMemo, useEffect, useRef, useCallback,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { SettingsScreens } from '../../../types';
import type { FolderEditDispatch } from '../../../hooks/reducers/useFoldersReducer';

import {
  ALL_FOLDER_ID,
  ARCHIVED_FOLDER_ID,
  CHAT_HEIGHT_PX,
  CHAT_LIST_SLICE,
} from '../../../config';
import { IS_MAC_OS, IS_PWA } from '../../../util/environment';
import { mapValues } from '../../../util/iteratees';
import { getPinnedChatsCount, getOrderKey } from '../../../util/folderManager';

import usePrevious from '../../../hooks/usePrevious';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import { useFolderManagerForOrderedIds } from '../../../hooks/useFolderManager';
import { useChatAnimationType } from './hooks';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import { useHotkeys } from '../../../hooks/useHotkeys';
import useDebouncedCallback from '../../../hooks/useDebouncedCallback';

import InfiniteScroll from '../../ui/InfiniteScroll';
import Loading from '../../ui/Loading';
import Chat from './Chat';
import EmptyFolder from './EmptyFolder';

type OwnProps = {
  folderType: 'all' | 'archived' | 'folder';
  folderId?: number;
  isActive: boolean;
  lastSyncTime?: number;
  foldersDispatch?: FolderEditDispatch;
  onScreenSelect?: (screen: SettingsScreens) => void;
};

const INTERSECTION_THROTTLE = 200;
const DRAG_ENTER_DEBOUNCE = 500;

const ChatList: FC<OwnProps> = ({
  folderType,
  folderId,
  isActive,
  foldersDispatch,
  onScreenSelect,
}) => {
  const { openChat, openNextChat } = getActions();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldIgnoreDragRef = useRef(false);

  const resolvedFolderId = (
    folderType === 'all' ? ALL_FOLDER_ID : folderType === 'archived' ? ARCHIVED_FOLDER_ID : folderId!
  );

  const orderedIds = useFolderManagerForOrderedIds(resolvedFolderId);

  const orderById = useMemo(() => {
    if (!orderedIds) {
      return undefined;
    }

    return orderedIds.reduce((acc, id, i) => {
      acc[id] = i;
      return acc;
    }, {} as Record<string, number>);
  }, [orderedIds]);

  const prevOrderById = usePrevious(orderById);

  const orderDiffById = useMemo(() => {
    if (!orderById || !prevOrderById) {
      return {};
    }

    return mapValues(orderById, (order, id) => {
      return prevOrderById[id] !== undefined ? order - prevOrderById[id] : -Infinity;
    });
  }, [orderById, prevOrderById]);

  const [viewportIds, getMore] = useInfiniteScroll(undefined, orderedIds, undefined, CHAT_LIST_SLICE);

  // Support <Alt>+<Up/Down> to navigate between chats
  useHotkeys(isActive && orderedIds?.length ? {
    'Alt+ArrowUp': (e: KeyboardEvent) => {
      e.preventDefault();
      openNextChat({ targetIndexDelta: -1, orderedIds });
    },
    'Alt+ArrowDown': (e: KeyboardEvent) => {
      e.preventDefault();
      openNextChat({ targetIndexDelta: 1, orderedIds });
    },
  } : undefined);

  // Support <Cmd>+<Digit> to navigate between chats
  useEffect(() => {
    if (!isActive || !orderedIds || !IS_PWA) {
      return undefined;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (((IS_MAC_OS && e.metaKey) || (!IS_MAC_OS && e.ctrlKey)) && e.code.startsWith('Digit')) {
        const [, digit] = e.code.match(/Digit(\d)/) || [];
        if (!digit) return;

        const position = Number(digit) - 1;
        if (position > orderedIds!.length - 1 || position < 0) return;

        openChat({ id: orderedIds![position], shouldReplaceHistory: true });
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, openChat, openNextChat, orderedIds]);

  const getAnimationType = useChatAnimationType(orderDiffById);

  const { observe } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  });

  const handleDragEnter = useDebouncedCallback((chatId: string) => {
    if (shouldIgnoreDragRef.current) {
      shouldIgnoreDragRef.current = false;
      return;
    }
    openChat({ id: chatId, shouldReplaceHistory: true });
  }, [], DRAG_ENTER_DEBOUNCE, true);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < rect.width || y < rect.y) return;
    shouldIgnoreDragRef.current = true;
  }, []);

  function renderChats() {
    const viewportOffset = orderedIds!.indexOf(viewportIds![0]);
    const pinnedCount = getPinnedChatsCount(resolvedFolderId) || 0;

    return viewportIds!.map((id, i) => {
      const isPinned = viewportOffset + i < pinnedCount;

      return (
        <Chat
          key={id}
          teactOrderKey={isPinned ? i : getOrderKey(id)}
          chatId={id}
          isPinned={isPinned}
          folderId={folderId}
          animationType={getAnimationType(id)}
          orderDiff={orderDiffById[id]}
          style={`top: ${(viewportOffset + i) * CHAT_HEIGHT_PX}px;`}
          observeIntersection={observe}
          onDragEnter={handleDragEnter}
        />
      );
    });
  }

  return (
    <InfiniteScroll
      className="chat-list custom-scroll"
      ref={containerRef}
      items={viewportIds}
      preloadBackwards={CHAT_LIST_SLICE}
      withAbsolutePositioning
      maxHeight={(orderedIds?.length || 0) * CHAT_HEIGHT_PX}
      onLoadMore={getMore}
      onDragLeave={handleDragLeave}
    >
      {viewportIds?.length ? (
        renderChats()
      ) : viewportIds && !viewportIds.length ? (
        (
          <EmptyFolder
            folderId={folderId}
            folderType={folderType}
            foldersDispatch={foldersDispatch}
            onScreenSelect={onScreenSelect}
          />
        )
      ) : (
        <Loading key="loading" />
      )}
    </InfiniteScroll>
  );
};

export default memo(ChatList);
