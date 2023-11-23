/* eslint-disable react/jsx-props-no-spreading */
import type { RefObject } from 'react';
import React from 'react';
import type { TreeInformation, TreeItemRenderContext } from 'react-complex-tree';
import type { FC } from '../../../../../../lib/teact/teact';

import type { TreeItemChat } from '../../types';

import Chat from './Chat';
import ChatFolder from './ChatFolder';

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
