import type { RefObject } from 'react';
import type { TreeItem } from 'react-complex-tree';

import type { ApiChat } from '../../../../api/types';
import type { MenuItemContextAction } from '../../../ui/ListItem';
import type { TabWithProperties } from '../../../ui/TabList';

// TODO better names
export type TreeItemChat<T extends any> = TreeItem<T> & {
  type: 'folder' | 'chat' | 'thread';
  unreadCount: number | undefined;
  contextActions: MenuItemContextAction[] | undefined;
  ref?: RefObject<HTMLDivElement>;
};

export type TreeItemFolder = TabWithProperties & {
  chatIds: string[];
  chats: Record<string, ApiChat>;
};
