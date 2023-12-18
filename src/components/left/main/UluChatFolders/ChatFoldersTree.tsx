/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/jsx-no-bind */
import React, {
  createRef, useMemo, useRef,
} from 'react';
import type {
  TreeEnvironmentRef, TreeItemIndex,
} from 'react-complex-tree';
import type { FC } from '../../../../lib/teact/teact';
import {
  getActions, getGlobal,
  withGlobalReact as withGlobal,
} from '../../../../global';

import type { ApiChat, ApiChatFolder, ApiChatlistExportedInvite } from '../../../../api/types';
import type { MenuItemContextAction } from '../../../ui/ListItem';
import type { TreeItemChat, TreeItemFolder } from './types';

import { ALL_FOLDER_ID, DEFAULT_WORKSPACE } from '../../../../config';
import { selectCanShareFolder, selectCurrentChat } from '../../../../global/selectors';
import { selectCurrentLimit } from '../../../../global/selectors/limits';
import { isWorkspaceChatTimeSnapshotStale } from '../../../../global/ulu/workspaces';
import buildClassName from '../../../../util/buildClassName';
import { getOrderedIds as getOrderedChatIds } from '../../../../util/folderManager';

import { useFolderManagerForUnreadCounters } from '../../../../hooks/useFolderManager.react';
import useLang from '../../../../hooks/useLang.react';
import { useWorkspaces } from '../../../../hooks/useWorkspaces.react';

import InfiniteScroll from '../../../ui/InfiniteScroll.react';
import TreeRenders from './TreeRenderers';
import UluControlledTreeEnvironment from './UluControlledTreeEnvironment';

import styles from './ChatFoldersTree.module.scss';

type OwnProps = {};
type StateProps = {
  orderedFolderIds?: number[];
  folderInvitesById: Record<number, ApiChatlistExportedInvite[]>;
  chatFoldersById: Record<number, ApiChatFolder>;
  orderedPinnedChatIds: string[] | undefined;
  chatsById: Record<string, ApiChat>;
  maxFolderInvites: number;
  maxChatLists: number;
  maxFolders: number;
  currentChat: ApiChat | undefined;
};

// TODO clean-up
const ChatFoldersTree: FC<OwnProps & StateProps> = ({
  chatsById,
  chatFoldersById,
  folderInvitesById,
  orderedFolderIds,
  maxChatLists,
  maxFolders,
  maxFolderInvites,
  currentChat,
}) => {
  const lang = useLang();

  const folderCountersById = useFolderManagerForUnreadCounters();

  const {
    // loadChatFolders,
    // setActiveChatFolder,
    // openChat,
    openShareChatFolderModal,
    openDeleteChatFolderModal,
    openEditChatFolder,
    openLimitReachedModal,
  } = getActions();

  const { currentWorkspaceId, currentWorkspace, savedWorkspaces } = useWorkspaces();
  const { chatSnapshotsTemp = [] } = currentWorkspace;
  const allFolderIdsInWorkspaces = savedWorkspaces
    .filter((ws) => ws.id !== currentWorkspace.id)
    .reduce((acc, ws) => {
      return [...acc, ...(ws.folders || [])];
    }, [] as number[]); // Указываем явно тип начального значения как number[]

  const workspaceTempChatIds = useMemo(() => {
    if (chatSnapshotsTemp.length === 0) { return []; }
    return chatSnapshotsTemp
      .filter((chatSnapshot) => !isWorkspaceChatTimeSnapshotStale(chatSnapshot))
      .map((chat) => chat.id);
  // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [currentWorkspaceId, chatSnapshotsTemp]);

  const displayedFolders = (() => {
    return orderedFolderIds
      ? orderedFolderIds.map((id) => {
        // Пропускаем папки, которые уже назначены другим воркспейсам, если выбран Personal Workspace
        if (currentWorkspace.id === DEFAULT_WORKSPACE.id && allFolderIdsInWorkspaces.includes(id)) {
          return undefined;
        }

        const folder = chatFoldersById[id];

        // Показываем папку только если она принадлежит текущему воркспейсу
        if (
          currentWorkspace.id !== DEFAULT_WORKSPACE.id
          && !savedWorkspaces.find((ws) => ws.id === currentWorkspace.id)?.folders?.includes(id)) {
          return undefined;
        }

        return folder || undefined;
      }).filter(Boolean)
      : undefined;
  })();

  const folders = (() => {
    if (!displayedFolders || !displayedFolders.length) {
      return [];
    }

    return displayedFolders.map((folder, i) => {
      const {
        id, title, pinnedChatIds = [],
      } = folder;
      const isBlocked = i > maxFolders - 1;
      const canShareFolder = selectCanShareFolder(getGlobal(), id);
      const contextActions: MenuItemContextAction[] = [];

      if (canShareFolder) {
        contextActions.push({
          title: lang('ChatList.ContextMenuShare'),
          icon: 'link',
          handler: () => {
            const chatListCount = Object.values(chatFoldersById).reduce((acc, el) => acc + (el.isChatList ? 1 : 0), 0);
            if (chatListCount >= maxChatLists && !folder.isChatList) {
              openLimitReachedModal({
                limit: 'chatlistJoined',
              });
              return;
            }

            // Greater amount can be after premium downgrade
            if (folderInvitesById[id]?.length >= maxFolderInvites) {
              openLimitReachedModal({
                limit: 'chatlistInvites',
              });
              return;
            }

            openShareChatFolderModal({
              folderId: id,
            });
          },
        });
      }

      if (id !== ALL_FOLDER_ID) {
        contextActions.push({
          title: lang('FilterEdit'),
          icon: 'edit',
          handler: () => {
            openEditChatFolder({ folderId: id });
          },
        });

        contextActions.push({
          title: lang('FilterDeleteItem'),
          icon: 'delete',
          destructive: true,
          handler: () => {
            openDeleteChatFolderModal({ folderId: id });
          },
        });
      }

      const orderedChatIds = getOrderedChatIds(id) || [];

      return {
        id,
        title,
        badgeCount: folderCountersById[id]?.chatsCount,
        isBadgeActive: Boolean(folderCountersById[id]?.notificationsCount),
        isBlocked,
        contextActions: contextActions?.length ? contextActions : undefined,
        chatIds: orderedChatIds,
        chats: Object.values(chatsById)
          .filter((chat) => orderedChatIds.includes(chat.id))
          .reduce((p, c) => {
            p[c.id] = { ...c, isPinned: pinnedChatIds.includes(c.id), folderId: id } as ApiChat;
            return p;
          }, {} as Record<string, ApiChat>),
      } satisfies TreeItemFolder;
    }).filter((folder) => typeof folder.id === 'number');
  })();

  // eslint-disable-next-line no-null/no-null
  const treeEnvironmentRef = useRef<TreeEnvironmentRef>(null);

  const foldersToDisplay = useMemo(() => {
    const chatsLength = folders.reduce((length, folder) => length + folder.chatIds.length, 0);
    const tempChatsToDisplay = [...workspaceTempChatIds];
    let lastAdjustedIndex = 0;

    const items = folders.reduce((record, folder, index) => {
      const adjustedIndex = index + 1; // "inbox" (all chats) is not here

      const { chats, chatIds } = folder;
      const chatIndexes: number[] = [];

      chatIds.forEach((id, i) => {
        const chat = chats[id];
        if (!chat) {
          return;
        }

        const tempIndex = tempChatsToDisplay.findIndex((c) => c === chat.id);
        if (tempIndex !== -1) {
          tempChatsToDisplay.splice(tempIndex, 1);
        }

        const chatAdjustedIndex = (folders.length + 1) * (adjustedIndex + 1) + chatsLength * (i + 1) + i + 1;
        record[chatAdjustedIndex] = {
          index: chatAdjustedIndex,
          type: 'chat',
          contextActions: [],
          id: chat.id,
          chat,
          isPinned: chat.isPinned,
          isFirst: i === 0,
          folderId: chat.folderId,
          isFolder: false,
          canChangeFolder: folders.length > 1,
          isCurrentChat: currentChat && chat.id === currentChat.id,
          // isFolder: isChatSuperGroupWithTopics(chat),
          canRename: false,
          children: undefined, // TODO threads for supergroups
          data: chat.title,
          unreadCount: chat.unreadCount,
          ref: createRef<HTMLDivElement>(),
        };
        chatIndexes.push(chatAdjustedIndex);
        lastAdjustedIndex = chatAdjustedIndex;
      });

      record[adjustedIndex] = {
        index: adjustedIndex,
        id: folder.id!,
        type: 'folder',
        contextActions: folder.contextActions,
        isFolder: true,
        canRename: false,
        children: chatIndexes,
        data: folder.title,
        unreadCount: folder.badgeCount,
        ref: createRef<HTMLDivElement>(),
      };

      return record;
    }, {} as Record<TreeItemIndex, TreeItemChat<any>>);

    tempChatsToDisplay.forEach((id, i) => {
      const chat = chatsById[id];
      if (!chat) {
        return;
      }
      const tempChatAdjustedIndex = lastAdjustedIndex * tempChatsToDisplay.length + i + 1;

      items[tempChatAdjustedIndex] = {
        index: tempChatAdjustedIndex,
        type: 'chat',
        contextActions: [],
        id: chat.id,
        chat,
        isPinned: false,
        isFirst: i === 0,
        folderId: chat.folderId,
        isFolder: false,
        canChangeFolder: folders.length > 1,
        isCurrentChat: currentChat && chat.id === currentChat.id,
        isTempChat: true,
        canRename: false,
        children: undefined, // TODO threads for supergroups
        data: chat.title,
        unreadCount: chat.unreadCount,
        ref: createRef<HTMLDivElement>(),
      };
    });

    return {
      items: {
        ...items,
        root: {
          index: 'root',
          canMove: true,
          isFolder: true,
          children: Object.values(items)
            .filter((item) => item.type === 'folder' || item.isTempChat)
            .map((item) => item.index),
          data: 'root',
          canRename: true,
        } as TreeItemChat<any>,
      } as Record<TreeItemIndex, TreeItemChat<any>>,
    };
  }, [folders, workspaceTempChatIds, currentChat, chatsById]);

  const classNameInfiniteScroll = buildClassName(
    'custom-scroll',
    styles['infinite-scroll'],
  );

  return (
    <InfiniteScroll className={classNameInfiniteScroll}>
      <UluControlledTreeEnvironment
        ref={treeEnvironmentRef}
        id="chat-folders-tree"
        currentWorkspaceId={currentWorkspace.id}
        items={foldersToDisplay.items}
        totalFolders={folders.length}
        renderTreeContainer={TreeRenders.renderTreeContainer}
        renderLiveDescriptorContainer={TreeRenders.renderLiveDescriptorContainer}
        renderItemsContainer={TreeRenders.renderItemsContainer}
        renderItem={TreeRenders.renderItem}
        // renderItemArrow={TreeRenders.renderItemArrow}
        // renderDepthOffset={1}
        // renderDragBetweenLine={TreeRenders.renderDragBetweenLine}
        renderItemTitle={TreeRenders.renderItemTitle}
      />
    </InfiniteScroll>
  );
};

export default withGlobal(
  (global): StateProps => {
    const currentChat = selectCurrentChat(global);

    const {
      chatFolders: {
        byId: chatFoldersById,
        orderedIds: orderedFolderIds,
        invites: folderInvitesById,
      },
      chats: {
        byId: chatsById,
        orderedPinnedIds: { active: orderedPinnedChatIds },
      },
      // activeSessions: {
      //   byHash: sessions,
      // },
      // currentUserId,
      // archiveSettings,
    } = global;
    // const { shouldSkipHistoryAnimations, activeChatFolder } = selectTabState(global);

    return {
      chatFoldersById,
      chatsById,
      orderedPinnedChatIds,
      folderInvitesById,
      orderedFolderIds,
      // activeChatFolder,
      // currentUserId,
      // shouldSkipHistoryAnimations,
      // hasArchivedChats: Boolean(archived?.length),
      maxFolders: selectCurrentLimit(global, 'dialogFilters'),
      maxFolderInvites: selectCurrentLimit(global, 'chatlistInvites'),
      maxChatLists: selectCurrentLimit(global, 'chatlistJoined'),
      currentChat,
      // archiveSettings,
      // sessions,
    };
  },
)(ChatFoldersTree);
