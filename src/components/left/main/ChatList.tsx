import React, {
  FC, memo, useMemo, useCallback, useEffect,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import {
  ApiChat, ApiChatFolder, ApiUser, MAIN_THREAD_ID,
} from '../../../api/types';
import { NotifyException, NotifySettings } from '../../../types';

import { ALL_CHATS_PRELOAD_DISABLED, CHAT_HEIGHT_PX, CHAT_LIST_SLICE } from '../../../config';
import { IS_ANDROID } from '../../../util/environment';
import usePrevious from '../../../hooks/usePrevious';
import { mapValues, pick } from '../../../util/iteratees';
import { getChatOrder, prepareChatList, prepareFolderListIds } from '../../../modules/helpers';
import {
  selectChatFolder, selectCurrentMessageList, selectNotifyExceptions, selectNotifySettings,
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
};

type StateProps = {
  chatsById: Record<number, ApiChat>;
  usersById: Record<number, ApiUser>;
  chatFolder?: ApiChatFolder;
  listIds?: number[];
  currentChatId?: number;
  orderedPinnedIds?: number[];
  lastSyncTime?: number;
  isInDiscussionThread?: boolean;
  notifySettings: NotifySettings;
  notifyExceptions: Record<number, NotifyException>;
};

type DispatchProps = Pick<GlobalActions, 'loadMoreChats' | 'preloadTopChatMessages'>;

enum FolderTypeToListType {
  'all' = 'active',
  'archived' = 'archived'
}

const ChatList: FC<OwnProps & StateProps & DispatchProps> = ({
  folderType,
  folderId,
  noChatsText = 'Chat list is empty.',
  chatFolder,
  chatsById,
  usersById,
  listIds,
  currentChatId,
  orderedPinnedIds,
  lastSyncTime,
  isInDiscussionThread,
  notifySettings,
  notifyExceptions,
  loadMoreChats,
  preloadTopChatMessages,
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

  const orderDiffById = orderById && prevOrderById
    ? mapValues(orderById, (order, id) => {
      return order - (prevOrderById[id] !== undefined ? prevOrderById[id] : Infinity);
    })
    : {};

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
            isSelected={id === currentChatId && !isInDiscussionThread}
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
            isSelected={chat.id === currentChatId && !isInDiscussionThread}
            animationType={getAnimationType(chat.id)}
            orderDiff={orderDiffById[chat.id]}
            // @ts-ignore
            style={`top: ${(pinnedOffset + i) * CHAT_HEIGHT_PX}px;`}
          />
        ))}
      </div>
    );
  }

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
    const { chatId: currentChatId, threadId: currentThreadId } = selectCurrentMessageList(global) || {};

    const listType = folderType !== 'folder' ? FolderTypeToListType[folderType] : undefined;
    const chatFolder = folderId ? selectChatFolder(global, folderId) : undefined;

    return {
      chatsById,
      usersById,
      currentChatId,
      lastSyncTime,
      ...(listType ? {
        listIds: listIds[listType],
        orderedPinnedIds: orderedPinnedIds[listType],
      } : {
        chatFolder,
      }),
      isInDiscussionThread: currentThreadId !== MAIN_THREAD_ID,
      notifySettings: selectNotifySettings(global),
      notifyExceptions: selectNotifyExceptions(global),
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['loadMoreChats', 'preloadTopChatMessages']),
)(ChatList));
