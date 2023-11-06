/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/jsx-no-bind */
import React, { createRef } from 'react';
import type {
  TreeEnvironmentRef, TreeItem, TreeItemIndex, TreeRef,
} from 'react-complex-tree';
import { StaticTreeDataProvider, Tree, UncontrolledTreeEnvironment } from 'react-complex-tree';
import type { FC } from '../../../../lib/teact/teact';
import { useMemo, useRef } from '../../../../lib/teact/teact';

import type { TabWithProperties } from '../../../ui/TabList';
import type { TreeItemChat } from './types';

import TreeRenders from './TreeRenderers';

const getItemTitle = (item: TreeItem<any>) => item.data;
const spreadItem = (item: TreeItem<any>, data: string) => ({ ...item, data });

// TODO clean-up
const ChatFoldersTree: FC<{ folders: TabWithProperties[] }> = ({ folders }) => {
  // eslint-disable-next-line no-null/no-null
  const treeEnvironmentRef = useRef<TreeEnvironmentRef>(null);
  // eslint-disable-next-line no-null/no-null
  const treeRef = useRef<TreeRef>(null);

  const foldersToDisplay = useMemo(() => {
    const items = folders.reduce((record, folder, index) => {
      const adjustedIndex = index + 1; // "inbox" (all chats) is not here
      record[adjustedIndex] = {
        index: adjustedIndex,
        contextActions: folder.contextActions,
        isFolder: true,
        canRename: false,
        children: undefined,
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
          children: Object.values(items).map((item) => item.index),
          data: 'root',
          canRename: true,
        },
      },
    };
  }, [folders]);

  return (
    <div>
      <UncontrolledTreeEnvironment
        ref={treeEnvironmentRef}
        dataProvider={new StaticTreeDataProvider(foldersToDisplay.items, spreadItem)}
        getItemTitle={getItemTitle}
        viewState={{}}
        renderTreeContainer={TreeRenders.renderTreeContainer}
        renderLiveDescriptorContainer={TreeRenders.renderLiveDescriptorContainer}
        // renderItemsContainer={TreeRenders.renderItemsContainer}
        // @ts-ignore
        renderItem={TreeRenders.renderItem}
        renderItemArrow={TreeRenders.renderItemArrow}
        // renderDepthOffset={1}
        renderDragBetweenLine={TreeRenders.renderDragBetweenLine}
        renderItemTitle={TreeRenders.renderItemTitle}
        // renderRenameInput={() => <>renameInput</>}
        // renderSearchInput={() => <>searchInput</>}
      >
        <Tree ref={treeRef} treeId="tree-1" rootItem="root" treeLabel="Tree Example" />
      </UncontrolledTreeEnvironment>
    </div>
  );
};

export default ChatFoldersTree;
