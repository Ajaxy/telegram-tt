import React from 'react';

import type { AllChatFoldersTreeRenderProps } from '../types';

import TreeContainer from './TreeContainer';
import TreeItem from './TreeItem';
import TreeItemsContainer from './TreeItemsContainer';
import TreeItemTitle from './TreeItemTitle';
import TreeLiveDescriptor from './TreeLiveDescriptorContainer';

const renders: AllChatFoldersTreeRenderProps = {
  renderTreeContainer: TreeContainer,
  renderItemsContainer: TreeItemsContainer,
  renderItem: TreeItem,
  renderItemTitle: TreeItemTitle,
  renderItemArrow: () => <>ItemArrow</>,
  renderRenameInput: () => <>RenameInput</>,
  renderSearchInput: () => <>SearchInput</>,
  renderDragBetweenLine: () => <>DragBetweenLine</>,
  renderDepthOffset: 0,
  renderLiveDescriptorContainer: TreeLiveDescriptor,
};

export default renders;
