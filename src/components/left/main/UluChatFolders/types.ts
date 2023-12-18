import type { RefObject } from 'react';
import type {
  TreeInformation, TreeItem, TreeItemRenderContext, TreeRenderProps,
} from 'react-complex-tree';

import type { ApiChat, ApiUser } from '../../../../api/types';
import type { MenuItemContextAction } from '../../../ui/ListItem';
import type { TabWithProperties } from '../../../ui/TabList';

// TODO better names
export type TreeItemChat<T extends any> = TreeItem<T> & {
  type: 'folder' | 'chat' | 'thread';
  id: number | string;
  chat?: ApiChat;
  unreadCount: number | undefined;
  contextActions?: MenuItemContextAction[];
  ref?: RefObject<HTMLDivElement>;
  user?: ApiUser;
  canChangeFolder?: boolean;
  isPinned?: boolean;
  isCurrentChat?: boolean;
  isTempChat?: boolean;
  isFirst?: boolean;
  folderId?: number;
};

export type TreeItemFolder = TabWithProperties & {
  chatIds: string[];
  chats: Record<string, ApiChat>;
};

type OmittedTreeRenderProps<T = any, C extends string = never> = Omit<
TreeRenderProps<T, C>,
'renderItem'
>;

export type ChatFoldersTreeRenderProps<T = any, C extends string = never> = OmittedTreeRenderProps<T, C> & {
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

export type AllChatFoldersTreeRenderProps<T = any, C extends string = never> = Required<
ChatFoldersTreeRenderProps<T, C>
>;
