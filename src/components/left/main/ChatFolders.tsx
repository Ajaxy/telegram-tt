import React, {
  FC, memo, useCallback, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../lib/teact/teactn';

import { ApiChat, ApiChatFolder, ApiUser } from '../../../api/types';
import { GlobalState } from '../../../global/types';
import { NotifyException, NotifySettings, SettingsScreens } from '../../../types';
import { FolderEditDispatch } from '../../../hooks/reducers/useFoldersReducer';

import { IS_TOUCH_ENV } from '../../../util/environment';
import { ALL_FOLDER_ID } from '../../../config';
import { buildCollectionByKey } from '../../../util/iteratees';
import { captureEvents, SwipeDirection } from '../../../util/captureEvents';
import { getFolderUnreadDialogs } from '../../../modules/helpers';
import { selectNotifyExceptions, selectNotifySettings } from '../../../modules/selectors';
import useShowTransition from '../../../hooks/useShowTransition';
import buildClassName from '../../../util/buildClassName';
import useThrottledMemo from '../../../hooks/useThrottledMemo';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';
import captureEscKeyListener from '../../../util/captureEscKeyListener';

import Transition from '../../ui/Transition';
import TabList from '../../ui/TabList';
import ChatList from './ChatList';

type OwnProps = {
  onScreenSelect: (screen: SettingsScreens) => void;
  foldersDispatch: FolderEditDispatch;
};

type StateProps = {
  allListIds: GlobalState['chats']['listIds'];
  chatsById: Record<string, ApiChat>;
  usersById: Record<string, ApiUser>;
  chatFoldersById: Record<number, ApiChatFolder>;
  notifySettings: NotifySettings;
  notifyExceptions?: Record<number, NotifyException>;
  orderedFolderIds?: number[];
  activeChatFolder: number;
  currentUserId?: string;
  lastSyncTime?: number;
  shouldSkipHistoryAnimations?: boolean;
};

const INFO_THROTTLE = 3000;
const SAVED_MESSAGES_HOTKEY = '0';

const ChatFolders: FC<OwnProps & StateProps> = ({
  allListIds,
  chatsById,
  usersById,
  chatFoldersById,
  notifySettings,
  notifyExceptions,
  orderedFolderIds,
  activeChatFolder,
  currentUserId,
  lastSyncTime,
  shouldSkipHistoryAnimations,
  foldersDispatch,
  onScreenSelect,
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

  const folderCountersById = useThrottledMemo(() => {
    if (!displayedFolders || !displayedFolders.length) {
      return undefined;
    }

    const counters = displayedFolders.map((folder) => {
      const {
        unreadDialogsCount, hasActiveDialogs,
      } = getFolderUnreadDialogs(allListIds, chatsById, usersById, folder, notifySettings, notifyExceptions) || {};

      return {
        id: folder.id,
        badgeCount: unreadDialogsCount,
        isBadgeActive: hasActiveDialogs,
      };
    });

    return buildCollectionByKey(counters, 'id');
  }, INFO_THROTTLE, [displayedFolders, allListIds, chatsById, usersById, notifySettings, notifyExceptions]);

  const folderTabs = useMemo(() => {
    if (!displayedFolders || !displayedFolders.length) {
      return undefined;
    }

    return [
      { title: lang.code === 'en' ? 'All' : lang('FilterAllChats'), id: ALL_FOLDER_ID },
      ...displayedFolders.map((folder) => ({
        title: folder.title,
        ...(folderCountersById?.[folder.id]),
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
      chats: { listIds: allListIds, byId: chatsById },
      users: { byId: usersById },
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
      allListIds,
      chatsById,
      usersById,
      chatFoldersById,
      orderedFolderIds,
      lastSyncTime,
      notifySettings: selectNotifySettings(global),
      notifyExceptions: selectNotifyExceptions(global),
      activeChatFolder,
      currentUserId,
      shouldSkipHistoryAnimations,
    };
  },
)(ChatFolders));
