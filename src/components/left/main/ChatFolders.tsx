import React, {
  FC, memo, useCallback, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../lib/teact/teactn';

import { ApiChatFolder } from '../../../api/types';
import { SettingsScreens } from '../../../types';
import { FolderEditDispatch } from '../../../hooks/reducers/useFoldersReducer';

import { ALL_FOLDER_ID } from '../../../config';
import { IS_TOUCH_ENV } from '../../../util/environment';
import { captureEvents, SwipeDirection } from '../../../util/captureEvents';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import useShowTransition from '../../../hooks/useShowTransition';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';

import Transition from '../../ui/Transition';
import TabList from '../../ui/TabList';
import ChatList from './ChatList';
import { useFolderManagerForUnreadCounters } from '../../../hooks/useFolderManager';

type OwnProps = {
  onScreenSelect: (screen: SettingsScreens) => void;
  foldersDispatch: FolderEditDispatch;
};

type StateProps = {
  chatFoldersById: Record<number, ApiChatFolder>;
  orderedFolderIds?: number[];
  activeChatFolder: number;
  currentUserId?: string;
  lastSyncTime?: number;
  shouldSkipHistoryAnimations?: boolean;
};

const SAVED_MESSAGES_HOTKEY = '0';

const ChatFolders: FC<OwnProps & StateProps> = ({
  foldersDispatch,
  onScreenSelect,
  chatFoldersById,
  orderedFolderIds,
  activeChatFolder,
  currentUserId,
  lastSyncTime,
  shouldSkipHistoryAnimations,
}) => {
  const {
    loadChatFolders,
    setActiveChatFolder,
    openChat,
  } = getDispatch();

  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);

  const lang = useLang();

  useEffect(() => {
    if (lastSyncTime) {
      loadChatFolders();
    }
  }, [lastSyncTime, loadChatFolders]);

  const displayedFolders = useMemo(() => {
    return orderedFolderIds
      ? orderedFolderIds.map((id) => chatFoldersById[id] || {}).filter(Boolean)
      : undefined;
  }, [chatFoldersById, orderedFolderIds]);

  const folderCountersById = useFolderManagerForUnreadCounters();
  const folderTabs = useMemo(() => {
    if (!displayedFolders || !displayedFolders.length) {
      return undefined;
    }

    return [
      {
        id: ALL_FOLDER_ID,
        title: lang.code === 'en' ? 'All' : lang('FilterAllChats'),
      },
      ...displayedFolders.map(({ id, title }) => ({
        id,
        title,
        badgeCount: folderCountersById[id]?.chatsCount,
        isBadgeActive: Boolean(folderCountersById[id]?.notificationsCount),
      })),
    ];
  }, [displayedFolders, folderCountersById, lang]);

  const handleSwitchTab = useCallback((index: number) => {
    setActiveChatFolder(index, { forceOnHeavyAnimation: true });
  }, [setActiveChatFolder]);

  // Prevent `activeTab` pointing at non-existing folder after update
  useEffect(() => {
    if (!folderTabs || !folderTabs.length) {
      return;
    }

    if (activeChatFolder >= folderTabs.length) {
      setActiveChatFolder(0);
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

  const isNotInAllTabRef = useRef();
  isNotInAllTabRef.current = activeChatFolder !== 0;
  useEffect(() => (isNotInAllTabRef.current ? captureEscKeyListener(() => {
    if (isNotInAllTabRef.current) {
      setActiveChatFolder(0);
    }
  }) : undefined), [activeChatFolder, setActiveChatFolder]);

  useHistoryBack(activeChatFolder !== 0, () => setActiveChatFolder(0, { forceOnHeavyAnimation: true }));

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
  });

  const {
    shouldRender: shouldRenderPlaceholder, transitionClassNames,
  } = useShowTransition(!orderedFolderIds, undefined, true);

  function renderCurrentTab(isActive: boolean) {
    const activeFolder = Object.values(chatFoldersById)
      .find(({ id }) => id === folderTabs![activeChatFolder].id);

    if (!activeFolder || activeChatFolder === 0) {
      return (
        <ChatList
          folderType="all"
          isActive={isActive}
          lastSyncTime={lastSyncTime}
          foldersDispatch={foldersDispatch}
          onScreenSelect={onScreenSelect}
        />
      );
    }

    return (
      <ChatList
        folderType="folder"
        folderId={activeFolder.id}
        isActive={isActive}
        lastSyncTime={lastSyncTime}
        onScreenSelect={onScreenSelect}
        foldersDispatch={foldersDispatch}
      />
    );
  }

  return (
    <div className="ChatFolders">
      {folderTabs?.length ? (
        <TabList tabs={folderTabs} activeTab={activeChatFolder} onSwitchTab={handleSwitchTab} />
      ) : shouldRenderPlaceholder ? (
        <div className={buildClassName('tabs-placeholder', transitionClassNames)} />
      ) : undefined}
      <Transition
        ref={transitionRef}
        name={shouldSkipHistoryAnimations ? 'none' : lang.isRtl ? 'slide-optimized-rtl' : 'slide-optimized'}
        activeKey={activeChatFolder}
        renderCount={folderTabs ? folderTabs.length : undefined}
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
      lastSyncTime,
      shouldSkipHistoryAnimations,
    };
  },
)(ChatFolders));
