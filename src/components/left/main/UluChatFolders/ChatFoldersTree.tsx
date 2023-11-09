/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/jsx-no-bind */
import React, { createRef } from 'react';
import type {
  TreeEnvironmentRef, TreeItem, TreeItemIndex, TreeRef,
} from 'react-complex-tree';
import { Tree, UncontrolledTreeEnvironment } from 'react-complex-tree';
import type { FC } from '../../../../lib/teact/teact';
import { useCallback, useMemo, useRef } from '../../../../lib/teact/teact';

import type { TreeItemChat, TreeItemFolder } from './types';

// import { isChatSuperGroupWithTopics } from '../../../../global/helpers';
import buildClassName from '../../../../util/buildClassName';

import InfiniteScroll from '../../../ui/InfiniteScroll.react';
// import { isChatSuperGroupWithTopics } from '../../../../global/helpers';
import TreeRenders from './TreeRenderers';

import styles from './ChatFoldersTree.module.scss';

const getItemTitle = (item: TreeItem<any>) => item.data;

type OwnProps = {
  folders: TreeItemFolder[];
};

// TODO clean-up
const ChatFoldersTree: FC<OwnProps> = ({ folders }) => {
  // eslint-disable-next-line no-null/no-null
  const treeEnvironmentRef = useRef<TreeEnvironmentRef>(null);
  // eslint-disable-next-line no-null/no-null
  const treeRef = useRef<TreeRef>(null);

  const foldersToDisplay = useMemo(() => {
    const chatsLength = folders.reduce((length, folder) => length + folder.chatIds.length, 0);
    const items = folders.reduce((record, folder, index) => {
      const adjustedIndex = index + 1; // "inbox" (all chats) is not here

      const { chats, chatIds } = folder;
      const chatIndexes: number[] = [];

      chatIds.forEach((id, i) => {
        const chat = chats[id];
        if (!chat) {
          return;
        }

        const chatAdjustedIndex = (folders.length + 1) * (adjustedIndex + 1) + chatsLength * (i + 1) + i + 1;
        record[chatAdjustedIndex] = {
          index: chatAdjustedIndex,
          type: 'chat',
          contextActions: [], // TODO
          id: chat.id,
          chat,
          isFolder: false,
          // isFolder: isChatSuperGroupWithTopics(chat),
          canRename: false,
          children: undefined, // TODO threads for supergroups
          data: chat.title,
          unreadCount: chat.unreadCount,
          ref: createRef<HTMLDivElement>(),
        };
        chatIndexes.push(chatAdjustedIndex);
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

    return {
      items: {
        ...items,
        root: {
          index: 'root',
          canMove: true,
          isFolder: true,
          children: Object.values(items)
            .filter((item) => item.type === 'folder')
            .map((item) => item.index),
          data: 'root',
          canRename: true,
        } as TreeItemChat<any>,
      } as Record<TreeItemIndex, TreeItemChat<any>>,
    };
  }, [folders]);

  // eslint-disable-next-line no-async-without-await/no-async-without-await
  const getTreeItem = useCallback(async (itemId: TreeItemIndex) => {
    return foldersToDisplay.items[itemId] as TreeItemChat<any>;
  }, [foldersToDisplay]);

  const classNameInfiniteScroll = buildClassName(
    'custom-scroll',
    styles['infinite-scroll'],
  );

  return (
    <InfiniteScroll className={classNameInfiniteScroll}>
      <UncontrolledTreeEnvironment
        ref={treeEnvironmentRef}
        dataProvider={{
          getTreeItem,
        }}
        getItemTitle={getItemTitle}
        viewState={{}}
        renderTreeContainer={TreeRenders.renderTreeContainer}
        renderLiveDescriptorContainer={TreeRenders.renderLiveDescriptorContainer}
        renderItemsContainer={TreeRenders.renderItemsContainer}
        // @ts-ignore
        renderItem={TreeRenders.renderItem}
        // renderItemArrow={TreeRenders.renderItemArrow}
        // renderDepthOffset={1}
        // renderDragBetweenLine={TreeRenders.renderDragBetweenLine}
        renderItemTitle={TreeRenders.renderItemTitle}
      >
        <Tree ref={treeRef} treeId="tree-1" rootItem="root" treeLabel="Tree Example" />
      </UncontrolledTreeEnvironment>
    </InfiniteScroll>
  );
};

export default ChatFoldersTree;
