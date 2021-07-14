import React, {
  FC, memo, useMemo, useCallback, useEffect,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import {
  ApiChat, ApiChatFolder, ApiUser,
} from '../../../api/types';
import { NotifyException, NotifySettings } from '../../../types';

import { ALL_CHATS_PRELOAD_DISABLED, CHAT_HEIGHT_PX, CHAT_LIST_SLICE } from '../../../config';
import { IS_ANDROID } from '../../../util/environment';
import usePrevious from '../../../hooks/usePrevious';
import { mapValues, pick } from '../../../util/iteratees';
import { getChatOrder, prepareChatList, prepareFolderListIds } from '../../../modules/helpers';
import {
  selectChatFolder, selectNotifyExceptions, selectNotifySettings,
} from '../../../modules/selectors';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import { useChatAnimationType } from './hooks';

import InfiniteScroll from '../../ui/InfiniteScroll';
import Loading from '../../ui/Loading';
import Chat from './Chat';

type OwnProps = {
  folderType: 'all' | 'archived' | 'folder';
  folderId?: number;
  noChatsText?: string;
  isActive: boolean;
};

type StateProps = {
  chatsById: Record<number, ApiChat>;
  usersById: Record<number, ApiUser>;
  chatFolder?: ApiChatFolder;
  listIds?: number[];
  orderedPinnedIds?: number[];
  lastSyncTime?: number;
  notifySettings: NotifySettings;
  notifyExceptions?: Record<number, NotifyException>;
};

type DispatchProps = Pick<GlobalActions, 'loadMoreChats' | 'preloadTopChatMessages' | 'openChat' | 'openNextChat'>;

enum FolderTypeToListType {
  'all' = 'active',
  'archived' = 'archived'
}

const ChatList: FC<OwnProps & StateProps & DispatchProps> = ({
  folderType,
  folderId,
  noChatsText = 'Chat list is empty.',
  isActive,
  chatFolder,
  chatsById,
  usersById,
  listIds,
  orderedPinnedIds,
  lastSyncTime,
  notifySettings,
  notifyExceptions,
  loadMoreChats,
  preloadTopChatMessages,
  openChat,
  openNextChat,
}) => {
  const [currentListIds, currentPinnedIds] = useMemo(() => {
    return folderType === 'folder' && chatFolder
      ? prepareFolderListIds(chatsById, usersById, chatFolder, notifySettings, notifyExceptions)
      : [listIds, orderedPinnedIds];
  }, [folderType, chatFolder, chatsById, usersById, notifySettings, notifyExceptions, listIds, orderedPinnedIds]);

  const [orderById, orderedIds] = useMemo(() => {
    if (!currentListIds || (folderType === 'folder' && !chatFolder)) {
      return [];
    }
    const newChatArrays = prepareChatList(chatsById, currentListIds, currentPinnedIds, folderType);
    const singleList = [...newChatArrays.pinnedChats, ...newChatArrays.otherChats];
    const newOrderedIds = singleList.map(({ id }) => id);
    const newOrderById = singleList.reduce((acc, chat, i) => {
      acc[chat.id] = i;
      return acc;
    }, {} as Record<string, number>);

    return [newOrderById, newOrderedIds];
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

  // TODO Refactor to not call `prepareChatList` twice
  const chatArrays = viewportIds && prepareChatList(chatsById, viewportIds, currentPinnedIds, folderType);

  useEffect(() => {
    if (lastSyncTime && folderType === 'all') {
      preloadTopChatMessages();
    }
  }, [lastSyncTime, folderType, preloadTopChatMessages]);

  const getAnimationType = useChatAnimationType(orderDiffById);

  function renderChats() {
    const viewportOffset = orderedIds!.indexOf(viewportIds![0]);
    const pinnedOffset = viewportOffset + chatArrays!.pinnedChats.length;

    return (
      <div
        className="scroll-container"
        // @ts-ignore
        style={IS_ANDROID ? `height: ${orderedIds!.length * CHAT_HEIGHT_PX}px` : undefined}
        teactFastList
      >
        {chatArrays!.pinnedChats.map(({ id }, i) => (
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
        {chatArrays!.otherChats.map((chat, i) => (
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
        if (e.ctrlKey && e.code.startsWith('Digit')) {
          const [, digit] = e.code.match(/Digit(\d)/) || [];
          if (!digit) return;

          const position = Number(digit) - 1;
          if (position > orderedIds.length - 1) return;

          openChat({ id: orderedIds[position] });
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
      {viewportIds && viewportIds.length && chatArrays ? (
        renderChats()
      ) : viewportIds && !viewportIds.length ? (
        <div className="no-results">{noChatsText}</div>
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
      ...(listType ? {
        listIds: listIds[listType],
        orderedPinnedIds: orderedPinnedIds[listType],
      } : {
        chatFolder,
      }),
      notifySettings: selectNotifySettings(global),
      notifyExceptions: selectNotifyExceptions(global),
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'loadMoreChats',
    'preloadTopChatMessages',
    'openChat',
    'openNextChat',
  ]),
)(ChatList));
