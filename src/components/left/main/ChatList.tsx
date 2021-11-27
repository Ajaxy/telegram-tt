import React, {
  FC, memo, useMemo, useCallback, useEffect,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import {
  ApiChat, ApiChatFolder, ApiUser,
} from '../../../api/types';
import { NotifyException, NotifySettings, SettingsScreens } from '../../../types';
import { FolderEditDispatch } from '../../../hooks/reducers/useFoldersReducer';

import { ALL_CHATS_PRELOAD_DISABLED, CHAT_HEIGHT_PX, CHAT_LIST_SLICE } from '../../../config';
import { IS_ANDROID, IS_MAC_OS, IS_PWA } from '../../../util/environment';
import usePrevious from '../../../hooks/usePrevious';
import { mapValues, pick } from '../../../util/iteratees';
import {
  getChatOrder, prepareChatList, prepareFolderListIds, reduceChatList,
} from '../../../modules/helpers';
import {
  selectChatFolder, selectNotifyExceptions, selectNotifySettings,
} from '../../../modules/selectors';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import { useChatAnimationType } from './hooks';

import InfiniteScroll from '../../ui/InfiniteScroll';
import Loading from '../../ui/Loading';
import Chat from './Chat';
import EmptyFolder from './EmptyFolder';

type OwnProps = {
  folderType: 'all' | 'archived' | 'folder';
  folderId?: number;
  isActive: boolean;
  onScreenSelect?: (screen: SettingsScreens) => void;
  foldersDispatch?: FolderEditDispatch;
};

type StateProps = {
  chatsById: Record<string, ApiChat>;
  usersById: Record<string, ApiUser>;
  chatFolder?: ApiChatFolder;
  listIds?: string[];
  orderedPinnedIds?: string[];
  lastSyncTime?: number;
  notifySettings: NotifySettings;
  notifyExceptions?: Record<number, NotifyException>;
};

type DispatchProps = Pick<GlobalActions, (
  'loadMoreChats' | 'preloadTopChatMessages' | 'preloadArchivedChats' | 'openChat' | 'openNextChat'
)>;

enum FolderTypeToListType {
  'all' = 'active',
  'archived' = 'archived',
}

const ChatList: FC<OwnProps & StateProps & DispatchProps> = ({
  folderType,
  folderId,
  isActive,
  chatFolder,
  chatsById,
  usersById,
  listIds,
  orderedPinnedIds,
  lastSyncTime,
  foldersDispatch,
  notifySettings,
  notifyExceptions,
  onScreenSelect,
  loadMoreChats,
  preloadTopChatMessages,
  preloadArchivedChats,
  openChat,
  openNextChat,
}) => {
  const [currentListIds, currentPinnedIds] = useMemo(() => {
    return folderType === 'folder' && chatFolder
      ? prepareFolderListIds(chatsById, usersById, chatFolder, notifySettings, notifyExceptions)
      : [listIds, orderedPinnedIds];
  }, [folderType, chatFolder, chatsById, usersById, notifySettings, notifyExceptions, listIds, orderedPinnedIds]);

  const [orderById, orderedIds, chatArrays] = useMemo(() => {
    if (!currentListIds || (folderType === 'folder' && !chatFolder)) {
      return [];
    }

    const newChatArrays = prepareChatList(chatsById, currentListIds, currentPinnedIds, folderType);
    const singleList = ([] as ApiChat[]).concat(newChatArrays.pinnedChats, newChatArrays.otherChats);
    const newOrderedIds = singleList.map(({ id }) => id);
    const newOrderById = singleList.reduce((acc, chat, i) => {
      acc[chat.id] = i;
      return acc;
    }, {} as Record<string, number>);

    return [newOrderById, newOrderedIds, newChatArrays];
  }, [currentListIds, currentPinnedIds, folderType, chatFolder, chatsById]);

  const prevOrderById = usePrevious(orderById);

  const orderDiffById = useMemo(() => {
    if (!orderById || !prevOrderById) {
      return {};
    }

    return mapValues(orderById, (order, id) => {
      return order - (prevOrderById[id] !== undefined ? prevOrderById[id] : Infinity);
    });
  }, [orderById, prevOrderById]);

  const loadMoreOfType = useCallback(() => {
    loadMoreChats({ listType: folderType === 'archived' ? 'archived' : 'active' });
  }, [loadMoreChats, folderType]);

  const [viewportIds, getMore] = useInfiniteScroll(
    lastSyncTime ? loadMoreOfType : undefined,
    orderedIds,
    undefined,
    CHAT_LIST_SLICE,
    folderType === 'all' && !ALL_CHATS_PRELOAD_DISABLED,
  );

  const viewportChatArrays = useMemo(() => {
    if (!viewportIds || !chatArrays) {
      return undefined;
    }

    return reduceChatList(chatArrays, viewportIds);
  }, [chatArrays, viewportIds]);

  useEffect(() => {
    if (lastSyncTime && folderType === 'all') {
      preloadTopChatMessages();
      preloadArchivedChats();
    }
  }, [lastSyncTime, folderType, preloadTopChatMessages, preloadArchivedChats]);

  const getAnimationType = useChatAnimationType(orderDiffById);

  function renderChats() {
    const viewportOffset = orderedIds!.indexOf(viewportIds![0]);
    const pinnedOffset = viewportOffset + viewportChatArrays!.pinnedChats.length;

    return (
      <div
        className="scroll-container"
        // @ts-ignore
        style={IS_ANDROID ? `height: ${orderedIds!.length * CHAT_HEIGHT_PX}px` : undefined}
        teactFastList
      >
        {viewportChatArrays!.pinnedChats.map(({ id }, i) => (
          <Chat
            key={id}
            teactOrderKey={i}
            chatId={id}
            isPinned
            folderId={folderId}
            animationType={getAnimationType(id)}
            orderDiff={orderDiffById[id]}
            // @ts-ignore
            style={`top: ${(viewportOffset + i) * CHAT_HEIGHT_PX}px;`}
          />
        ))}
        {viewportChatArrays!.otherChats.map((chat, i) => (
          <Chat
            key={chat.id}
            teactOrderKey={getChatOrder(chat)}
            chatId={chat.id}
            folderId={folderId}
            animationType={getAnimationType(chat.id)}
            orderDiff={orderDiffById[chat.id]}
            // @ts-ignore
            style={`top: ${(pinnedOffset + i) * CHAT_HEIGHT_PX}px;`}
          />
        ))}
      </div>
    );
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isActive && orderedIds) {
        if (IS_PWA && ((IS_MAC_OS && e.metaKey) || (!IS_MAC_OS && e.ctrlKey)) && e.code.startsWith('Digit')) {
          const [, digit] = e.code.match(/Digit(\d)/) || [];
          if (!digit) return;

          const position = Number(digit) - 1;
          if (position > orderedIds.length - 1) return;

          openChat({ id: orderedIds[position], shouldReplaceHistory: true });
        }

        if (e.altKey) {
          const targetIndexDelta = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : undefined;
          if (!targetIndexDelta) return;

          e.preventDefault();
          openNextChat({ targetIndexDelta, orderedIds });
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, false);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, false);
    };
  });

  return (
    <InfiniteScroll
      className="chat-list custom-scroll"
      items={viewportIds}
      onLoadMore={getMore}
      preloadBackwards={CHAT_LIST_SLICE}
      noFastList
      noScrollRestore
    >
      {viewportIds?.length && viewportChatArrays ? (
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

export default memo(withGlobal<OwnProps>(
  (global, { folderType, folderId }): StateProps => {
    const {
      chats: {
        listIds,
        byId: chatsById,
        orderedPinnedIds,
      },
      users: { byId: usersById },
      lastSyncTime,
    } = global;
    const listType = folderType !== 'folder' ? FolderTypeToListType[folderType] : undefined;
    const chatFolder = folderId ? selectChatFolder(global, folderId) : undefined;

    return {
      chatsById,
      usersById,
      lastSyncTime,
      notifySettings: selectNotifySettings(global),
      notifyExceptions: selectNotifyExceptions(global),
      ...(listType ? {
        listIds: listIds[listType],
        orderedPinnedIds: orderedPinnedIds[listType],
      } : {
        chatFolder,
      }),
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'loadMoreChats',
    'preloadTopChatMessages',
    'preloadArchivedChats',
    'openChat',
    'openNextChat',
  ]),
)(ChatList));
