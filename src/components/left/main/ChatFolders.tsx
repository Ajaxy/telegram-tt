import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChatFolder } from '../../../api/types';
import type { SettingsScreens } from '../../../types';
import type { FolderEditDispatch } from '../../../hooks/reducers/useFoldersReducer';

import { ALL_FOLDER_ID } from '../../../config';
import { IS_TOUCH_ENV } from '../../../util/environment';
import { captureEvents, SwipeDirection } from '../../../util/captureEvents';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { selectCurrentLimit } from '../../../global/selectors/limits';
import useShowTransition from '../../../hooks/useShowTransition';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';
import { useFolderManagerForUnreadCounters } from '../../../hooks/useFolderManager';

import Transition from '../../ui/Transition';
import TabList from '../../ui/TabList';
import ChatList from './ChatList';
import { selectIsForumPanelOpen } from '../../../global/selectors';

type OwnProps = {
  onScreenSelect: (screen: SettingsScreens) => void;
  foldersDispatch: FolderEditDispatch;
  shouldHideFolderTabs?: boolean;
};

type StateProps = {
  chatFoldersById: Record<number, ApiChatFolder>;
  orderedFolderIds?: number[];
  activeChatFolder: number;
  currentUserId?: string;
  isForumPanelOpen?: boolean;
  lastSyncTime?: number;
  shouldSkipHistoryAnimations?: boolean;
  maxFolders: number;
};

const SAVED_MESSAGES_HOTKEY = '0';
const FIRST_FOLDER_INDEX = 0;

const ChatFolders: FC<OwnProps & StateProps> = ({
  foldersDispatch,
  onScreenSelect,
  chatFoldersById,
  orderedFolderIds,
  activeChatFolder,
  currentUserId,
  isForumPanelOpen,
  lastSyncTime,
  shouldSkipHistoryAnimations,
  maxFolders,
  shouldHideFolderTabs,
}) => {
  const {
    loadChatFolders,
    setActiveChatFolder,
    openChat,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);

  const lang = useLang();

  useEffect(() => {
    if (lastSyncTime) {
      loadChatFolders();
    }
  }, [lastSyncTime, loadChatFolders]);

  const allChatsFolder = useMemo(() => {
    return {
      id: ALL_FOLDER_ID,
      title: orderedFolderIds?.[0] === ALL_FOLDER_ID ? lang('FilterAllChatsShort') : lang('FilterAllChats'),
    };
  }, [orderedFolderIds, lang]);

  const displayedFolders = useMemo(() => {
    return orderedFolderIds
      ? orderedFolderIds.map((id) => {
        if (id === ALL_FOLDER_ID) {
          return allChatsFolder;
        }

        return chatFoldersById[id] || {};
      }).filter(Boolean)
      : undefined;
  }, [chatFoldersById, allChatsFolder, orderedFolderIds]);

  const allChatsFolderIndex = displayedFolders?.findIndex((folder) => folder.id === ALL_FOLDER_ID);
  const isInAllChatsFolder = allChatsFolderIndex === activeChatFolder;
  const isInFirstFolder = FIRST_FOLDER_INDEX === activeChatFolder;

  const folderCountersById = useFolderManagerForUnreadCounters();
  const folderTabs = useMemo(() => {
    if (!displayedFolders || !displayedFolders.length) {
      return undefined;
    }

    return displayedFolders.map(({ id, title }, i) => {
      const isBlocked = id !== ALL_FOLDER_ID && i > maxFolders - 1;

      return ({
        id,
        title,
        badgeCount: folderCountersById[id]?.chatsCount,
        isBadgeActive: Boolean(folderCountersById[id]?.notificationsCount),
        isBlocked,
      });
    });
  }, [displayedFolders, folderCountersById, maxFolders]);

  const handleSwitchTab = useCallback((index: number) => {
    setActiveChatFolder(index, { forceOnHeavyAnimation: true });
  }, [setActiveChatFolder]);

  // Prevent `activeTab` pointing at non-existing folder after update
  useEffect(() => {
    if (!folderTabs || !folderTabs.length) {
      return;
    }

    if (activeChatFolder >= folderTabs.length) {
      setActiveChatFolder(FIRST_FOLDER_INDEX);
    }
  }, [activeChatFolder, folderTabs, setActiveChatFolder]);

  useEffect(() => {
    if (!transitionRef.current || !IS_TOUCH_ENV || !folderTabs || !folderTabs.length) {
      return undefined;
    }

    return captureEvents(transitionRef.current, {
      selectorToPreventScroll: '.chat-list',
      onSwipe: ((e, direction) => {
        if (direction === SwipeDirection.Left) {
          setActiveChatFolder(Math.min(activeChatFolder + 1, folderTabs.length - 1), { forceOnHeavyAnimation: true });
          return true;
        } else if (direction === SwipeDirection.Right) {
          setActiveChatFolder(Math.max(0, activeChatFolder - 1), { forceOnHeavyAnimation: true });
          return true;
        }

        return false;
      }),
    });
  }, [activeChatFolder, folderTabs, setActiveChatFolder]);

  const isNotInFirstFolderRef = useRef();
  isNotInFirstFolderRef.current = !isInFirstFolder;
  useEffect(() => (isNotInFirstFolderRef.current ? captureEscKeyListener(() => {
    if (isNotInFirstFolderRef.current) {
      setActiveChatFolder(FIRST_FOLDER_INDEX);
    }
  }) : undefined), [activeChatFolder, setActiveChatFolder]);

  useHistoryBack({
    isActive: !isInFirstFolder,
    onBack: () => setActiveChatFolder(FIRST_FOLDER_INDEX, { forceOnHeavyAnimation: true }),
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.code.startsWith('Digit') && folderTabs) {
        const [, digit] = e.code.match(/Digit(\d)/) || [];
        if (!digit) return;

        if (digit === SAVED_MESSAGES_HOTKEY) {
          openChat({ id: currentUserId, shouldReplaceHistory: true });
          return;
        }

        const folder = Number(digit) - 1;
        if (folder > folderTabs.length - 1) return;

        setActiveChatFolder(folder, { forceOnHeavyAnimation: true });
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [currentUserId, folderTabs, openChat, setActiveChatFolder]);

  const {
    shouldRender: shouldRenderPlaceholder, transitionClassNames,
  } = useShowTransition(!orderedFolderIds, undefined, true);

  function renderCurrentTab(isActive: boolean) {
    const activeFolder = Object.values(chatFoldersById)
      .find(({ id }) => id === folderTabs![activeChatFolder].id);
    const isFolder = activeFolder && !isInAllChatsFolder;

    return (
      <ChatList
        folderType={isFolder ? 'folder' : 'all'}
        folderId={isFolder ? activeFolder.id : undefined}
        isActive={isActive}
        isForumPanelOpen={isForumPanelOpen}
        lastSyncTime={lastSyncTime}
        foldersDispatch={foldersDispatch}
        onScreenSelect={onScreenSelect}
      />
    );
  }

  const shouldRenderFolders = folderTabs && folderTabs.length > 1;

  return (
    <div
      className={buildClassName(
        'ChatFolders',
        shouldRenderFolders && shouldHideFolderTabs && 'ChatFolders--tabs-hidden',
      )}
    >
      {shouldRenderFolders ? (
        <TabList tabs={folderTabs} activeTab={activeChatFolder} onSwitchTab={handleSwitchTab} areFolders />
      ) : shouldRenderPlaceholder ? (
        <div className={buildClassName('tabs-placeholder', transitionClassNames)} />
      ) : undefined}
      <Transition
        ref={transitionRef}
        name={shouldSkipHistoryAnimations ? 'none' : lang.isRtl ? 'slide-optimized-rtl' : 'slide-optimized'}
        activeKey={activeChatFolder}
        renderCount={shouldRenderFolders ? folderTabs.length : undefined}
      >
        {renderCurrentTab}
      </Transition>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      chatFolders: {
        byId: chatFoldersById,
        orderedIds: orderedFolderIds,
        activeChatFolder,
      },
      currentUserId,
      lastSyncTime,
      shouldSkipHistoryAnimations,
    } = global;

    return {
      chatFoldersById,
      orderedFolderIds,
      activeChatFolder,
      currentUserId,
      isForumPanelOpen: selectIsForumPanelOpen(global),
      lastSyncTime,
      shouldSkipHistoryAnimations,
      maxFolders: selectCurrentLimit(global, 'dialogFilters'),
    };
  },
)(ChatFolders));
