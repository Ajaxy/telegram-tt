import React, {
  forwardRef,
  useCallback, useRef, useState,
} from 'react';
import type {
  ControlledTreeEnvironmentProps,
  TreeEnvironmentRef,
  TreeItem, TreeItemIndex, TreeRef,
} from 'react-complex-tree';
import { ControlledTreeEnvironment, Tree } from 'react-complex-tree';

import type { ChatFoldersTreeRenderProps } from './types';

type OwnProps = (
  Pick<
  ControlledTreeEnvironmentProps,
  'items' | 'renderTreeContainer' | 'renderItemsContainer' | 'renderItemTitle' | 'renderLiveDescriptorContainer'
  >
  & Pick<ChatFoldersTreeRenderProps, 'renderItem'>
  & {
    id: string;
  });

const getItemTitle = (item: TreeItem<any>) => item.data;

const UluControlledTreeEnvironment = forwardRef<TreeEnvironmentRef, OwnProps>(({
  items: propsItems, id, renderItem, renderItemTitle, renderItemsContainer, renderTreeContainer,
}, ref) => {
  // eslint-disable-next-line no-null/no-null
  const treeRef = useRef<TreeRef>(null);

  const [focusedItem, setFocusedItem] = useState<TreeItemIndex>();
  const [expandedItems, setExpandedItems] = useState<TreeItemIndex[]>([]);
  const [selectedItems, setSelectedItems] = useState<TreeItemIndex[]>([]);

  const handleFocusItem = useCallback((item: TreeItem<any>) => setFocusedItem(item.index), []);
  const handleExpandItem = useCallback(
    (item: TreeItem<any>) => setExpandedItems([...expandedItems, item.index]),
    [expandedItems],
  );
  const handleCollapseItem = useCallback(
    (item: TreeItem<any>) => setExpandedItems(
      expandedItems.filter((expandedItemIndex) => expandedItemIndex !== item.index),
    ),
    [expandedItems],
  );
  const handleSelectItems = useCallback(
    (items: TreeItemIndex[]) => setSelectedItems(items),
    [],
  );

  return (
    <ControlledTreeEnvironment
      items={propsItems}
      getItemTitle={getItemTitle}
      viewState={{
        [id]: {
          focusedItem,
          expandedItems,
          selectedItems,
        },
      }}
      onFocusItem={handleFocusItem}
      onExpandItem={handleExpandItem}
      onCollapseItem={handleCollapseItem}
      onSelectItems={handleSelectItems}
      ref={ref}
      renderTreeContainer={renderTreeContainer}
      renderItemsContainer={renderItemsContainer}
      // @ts-ignore
      renderItem={renderItem}
      renderItemTitle={renderItemTitle}
    >
      <Tree ref={treeRef} treeId={id} rootItem="root" />
    </ControlledTreeEnvironment>
  );
});

export default UluControlledTreeEnvironment;
