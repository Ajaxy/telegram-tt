/* eslint-disable react/jsx-props-no-spreading */
import type { RefObject } from 'react';
import React from 'react';
import type { TreeInformation, TreeItemRenderContext } from 'react-complex-tree';
import type { FC } from '../../../../../../lib/teact/teact';
import { getActions } from '../../../../../../lib/teact/teactn';

import type { TreeItemChat } from '../../types';

import useLastCallbackTeact from '../../../../../../hooks/useLastCallback';

import Chat from './Chat';
import ChatFolder from './ChatFolder';

// import useMenuPosition from '../../../../../../hooks/useMenuPosition';
// import Menu from './ContextMenu/Menu';
// import MenuItem from './ContextMenu/MenuItem';
// import MenuSeparator from './ContextMenu/MenuSeparator';

// const NONE_TO_VOID: NoneToVoidFunction = () => void 0;
// TODO clean up
type OwnProps = {
  ref: RefObject<HTMLDivElement>;
  item: TreeItemChat<any>;
  depth: number;
  children: React.ReactNode;
  title: React.ReactNode;
  arrow: React.ReactNode;
  context: TreeItemRenderContext<never>;
  info: TreeInformation;
};

const TreeItemComponent: FC<OwnProps> = ({
  title, item, context, children,
}) => {
  const {
    setActiveChatFolder,
  } = getActions();

  const handleClickFolder = useLastCallbackTeact((index: number | string) => {
    setActiveChatFolder({ activeChatFolder: index }, { forceOnHeavyAnimation: true });
  });

  if (item.type === 'chat') {
    return (
      <Chat
        item={item}
        context={context}
        active={context.isSelected}
        expanded={context.isExpanded}
        shouldStressUnreadMessages={false}
        title={title}
      >
        {children}
      </Chat>
    );
  }

  return (
    <ChatFolder
      onClick={handleClickFolder}
      item={item}
      context={context}
      active={context.isSelected}
      expanded={context.isExpanded}
      shouldStressUnreadMessages={false}
      title={title}
    >
      {children}
    </ChatFolder>
  );
};

export default TreeItemComponent;
