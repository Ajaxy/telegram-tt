import React, {
  forwardRef,
  useCallback, useEffect, useRef, useState,
} from 'react';
import type {
  ControlledTreeEnvironmentProps,
  TreeEnvironmentRef,
  TreeItem, TreeItemIndex, TreeRef,
} from 'react-complex-tree';
import { ControlledTreeEnvironment, Tree } from 'react-complex-tree';

import type { ChatFoldersTreeRenderProps, TreeItemChat } from './types';

type OwnProps = (
  Pick<
  ControlledTreeEnvironmentProps,
  'renderTreeContainer' | 'renderItemsContainer' | 'renderItemTitle' | 'renderLiveDescriptorContainer'
  >
  & Pick<ChatFoldersTreeRenderProps, 'renderItem'>
  & {
    id: string;
    items: Record<TreeItemIndex, TreeItemChat<string>>;
    totalFolders: number;
    currentWorkspaceId: string;
  });

const getItemTitle = (item: TreeItem<any>) => item.data;

const buildInitialExpandedItems = (
  { items, totalFolders }: { items: Record<TreeItemIndex, TreeItemChat<string>>; totalFolders: number },
) => {
  if (totalFolders !== 1) { return []; }

  const folder = Object.values(items).find((item) => item.type === 'folder');
  if (!folder) { return []; } // insanity check

  return [folder.index];
};

const UluControlledTreeEnvironment = forwardRef<TreeEnvironmentRef, OwnProps>(({
  items, id, renderItem, renderItemTitle, renderItemsContainer, renderTreeContainer, totalFolders, currentWorkspaceId,
}, ref) => {
  // eslint-disable-next-line no-null/no-null
  const treeRef = useRef<TreeRef>(null);

  const currentWorkspaceIdRef = useRef<string>(currentWorkspaceId);

  const [focusedItem, setFocusedItem] = useState<TreeItemIndex>();
  const [expandedItems, setExpandedItems] = useState<TreeItemIndex[]>(() => {
    // Загрузка сохраненного состояния для текущего воркспейса при монтировании компонента
    const savedExpandedItems = localStorage.getItem(`expandedItems-${currentWorkspaceId}-${id}`);
    return savedExpandedItems ? JSON.parse(savedExpandedItems) : buildInitialExpandedItems({ items, totalFolders });
  });
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
    (newSelectedItems: TreeItemIndex[]) => setSelectedItems(newSelectedItems),
    [],
  );

  useEffect(() => {
    if (currentWorkspaceId === currentWorkspaceIdRef.current) {
      return;
    }

    currentWorkspaceIdRef.current = currentWorkspaceId;
    const newExpandedItems = buildInitialExpandedItems({ items, totalFolders });
    setExpandedItems(newExpandedItems);
  }, [totalFolders, items, currentWorkspaceId]);

  // Обновление useEffect для отслеживания смены воркспейсов
  useEffect(() => {
    // Загрузка сохраненного состояния для нового воркспейса
    const savedExpandedItems = localStorage.getItem(`expandedItems-${currentWorkspaceId}-${id}`);
    if (savedExpandedItems) {
      setExpandedItems(JSON.parse(savedExpandedItems));
    } else {
      // Установка начального состояния раскрытых папок для нового воркспейса
      setExpandedItems(buildInitialExpandedItems({ items, totalFolders }));
    }
  }, [currentWorkspaceId, id, items, totalFolders]);

  // Сохранение состояния при его изменении
  useEffect(() => {
    localStorage.setItem(`expandedItems-${currentWorkspaceId}-${id}`, JSON.stringify(expandedItems));
  }, [expandedItems, currentWorkspaceId, id]);

  return (
    <ControlledTreeEnvironment
      items={items}
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
