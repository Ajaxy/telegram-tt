import React, {
  FC, memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { ApiChat, ApiChatFolder, ApiUser } from '../../../api/types';
import { GlobalActions } from '../../../global/types';

import { IS_TOUCH_ENV } from '../../../util/environment';
import { buildCollectionByKey, pick } from '../../../util/iteratees';
import { captureEvents, SwipeDirection } from '../../../util/captureEvents';
import { getFolderUnreadDialogs } from '../../../modules/helpers';
import useShowTransition from '../../../hooks/useShowTransition';
import buildClassName from '../../../util/buildClassName';
import useThrottledMemo from '../../../hooks/useThrottledMemo';
import useLang from '../../../hooks/useLang';
import captureEscKeyListener from '../../../util/captureEscKeyListener';

import Transition from '../../ui/Transition';
import TabList from '../../ui/TabList';
import ChatList from './ChatList';

type StateProps = {
  chatsById: Record<number, ApiChat>;
  usersById: Record<number, ApiUser>;
  chatFoldersById: Record<number, ApiChatFolder>;
  orderedFolderIds?: number[];
  lastSyncTime?: number;
};

type DispatchProps = Pick<GlobalActions, 'loadChatFolders'>;

const INFO_THROTTLE = 3000;

const ChatFolders: FC<StateProps & DispatchProps> = ({
  chatsById,
  usersById,
  chatFoldersById,
  orderedFolderIds,
  lastSyncTime,
  loadChatFolders,
}) => {
  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState(0);

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

    const chatIds = Object.keys(chatsById).map(Number);
    const counters = displayedFolders.map((folder) => {
      const {
        unreadDialogsCount, hasActiveDialogs,
      } = getFolderUnreadDialogs(chatsById, usersById, folder, chatIds) || {};

      return {
        id: folder.id,
        badgeCount: unreadDialogsCount,
        isBadgeActive: hasActiveDialogs,
      };
    });

    return buildCollectionByKey(counters, 'id');
  }, INFO_THROTTLE, [displayedFolders, chatsById, usersById]);

  const folderTabs = useMemo(() => {
    if (!displayedFolders || !displayedFolders.length) {
      return undefined;
    }

    return [
      { title: 'All' },
      ...displayedFolders.map((folder) => ({
        title: folder.title,
        ...(folderCountersById && folderCountersById[folder.id]),
      })),
    ];
  }, [displayedFolders, folderCountersById]);

  const handleSwitchTab = useCallback((index: number) => {
    setActiveTab(index);
  }, []);

  // Prevent `activeTab` pointing at non-existing folder after update
  useEffect(() => {
    if (!folderTabs || !folderTabs.length) {
      return;
    }

    if (activeTab >= folderTabs.length) {
      setActiveTab(0);
    }
  }, [activeTab, folderTabs]);

  useEffect(() => {
    if (!transitionRef.current || !IS_TOUCH_ENV || !folderTabs || !folderTabs.length) {
      return undefined;
    }

    return captureEvents(transitionRef.current, {
      onSwipe: ((e, direction) => {
        if (direction === SwipeDirection.Left) {
          setActiveTab(Math.min(activeTab + 1, folderTabs.length - 1));
        } else if (direction === SwipeDirection.Right) {
          setActiveTab(Math.max(0, activeTab - 1));
        }
      }),
    });
  }, [activeTab, folderTabs]);

  const isNotInAllTabRef = useRef();
  isNotInAllTabRef.current = activeTab !== 0;
  useEffect(() => captureEscKeyListener(() => {
    if (isNotInAllTabRef.current) {
      setActiveTab(0);
    }
  }), []);

  const {
    shouldRender: shouldRenderPlaceholder, transitionClassNames,
  } = useShowTransition(!orderedFolderIds, undefined, true);

  const lang = useLang();

  function renderCurrentTab() {
    const activeFolder = Object.values(chatFoldersById)
      .find(({ title }) => title === folderTabs![activeTab].title);

    if (!activeFolder || activeTab === 0) {
      return <ChatList folderType="all" />;
    }

    return <ChatList folderType="folder" folderId={activeFolder.id} noChatsText={lang('FilterNoChatsToDisplay')} />;
  }

  return (
    <div className="ChatFolders">
      {folderTabs && folderTabs.length ? (
        <TabList tabs={folderTabs} activeTab={activeTab} onSwitchTab={handleSwitchTab} />
      ) : shouldRenderPlaceholder ? (
        <div className={buildClassName('tabs-placeholder', transitionClassNames)} />
      ) : undefined}
      <Transition
        ref={transitionRef}
        name="slide"
        activeKey={activeTab}
        renderCount={folderTabs ? folderTabs.length : undefined}
      >
        {renderCurrentTab}
      </Transition>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const {
      chats: { byId: chatsById },
      users: { byId: usersById },
      chatFolders: {
        byId: chatFoldersById,
        orderedIds: orderedFolderIds,
      },
      lastSyncTime,
    } = global;

    return {
      chatsById,
      usersById,
      chatFoldersById,
      orderedFolderIds,
      lastSyncTime,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['loadChatFolders']),
)(ChatFolders));
