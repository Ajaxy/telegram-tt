import type { RefObject } from 'react';
import React from 'react';
import type {
  TreeInformation, TreeItemRenderContext, TreeRenderProps,
} from 'react-complex-tree';

import type { TreeItemChat } from '../types';

import TreeContainer from './TreeContainer';
import TreeItem from './TreeItem';
import TreeItemsContainer from './TreeItemsContainer';
import TreeItemTitle from './TreeItemTitle';
import TreeLiveDescriptor from './TreeLiveDescriptorContainer';

type OmittedTreeRenderProps<T = any, C extends string = never> = Omit<
TreeRenderProps<T, C>,
'renderItem'
>;

type ChatFoldersTreeRenderProps<T = any, C extends string = never> = OmittedTreeRenderProps<T, C> & {
  renderItem: (props: {
    ref: RefObject<HTMLDivElement>;
    item: TreeItemChat<T>;
    depth: number;
    children: React.ReactNode;
    title: React.ReactNode;
    arrow: React.ReactNode;
    context: TreeItemRenderContext<never>;
    info: TreeInformation;
  }) => React.ReactElement<any> | null;
};

type AllChatFoldersTreeRenderProps<T = any, C extends string = never> = Required<ChatFoldersTreeRenderProps<T, C>>;

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
