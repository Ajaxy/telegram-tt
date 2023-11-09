/* eslint-disable react/jsx-props-no-spreading */
import type { ReactNode } from 'react';
import React from 'react';
import type { TreeItemRenderContext } from 'react-complex-tree';
import type { FC } from '../../../../../../../lib/teact/teact';
import { getActions } from '../../../../../../../global';

import type { TreeItemChat } from '../../../types';

import { ULU_APP } from '../../../../../../../config';
import buildClassName from '../../../../../../../util/buildClassName';
import { MouseButton } from '../../../../../../../util/windowEnvironment';

import useContextMenuHandlers from '../../../../../../../hooks/useContextMenuHandlers.react';
import { useFastClick } from '../../../../../../../hooks/useFastClick.react';
import useLastCallbackTeact from '../../../../../../../hooks/useLastCallback';

import ChatAvatar from './ChatAvatar';

import stylesUluChatFolder from '../../../../UluChatFolder/UluChatFolder.module.scss';
import styles from '../ChatFolder.module.scss';

const Chat: FC<{
  children: ReactNode;
  item: TreeItemChat<any>;
  context: TreeItemRenderContext<never>;
  title: string | ReactNode;
  active: boolean | undefined;
  expanded?: boolean;
  shouldStressUnreadMessages: boolean;
  contextRootElementSelector?: string;
}> = ({
  children, active, title, shouldStressUnreadMessages, item, context,
}) => {
  const {
    contextActions, unreadCount: messagesUnreadCount, ref,
  } = item;

  const classNameWrapper = buildClassName(
    stylesUluChatFolder.wrapper,
    active && stylesUluChatFolder.active,
    !!messagesUnreadCount && shouldStressUnreadMessages && stylesUluChatFolder['has-unread-messages'],
  );

  const {
    handleContextMenu, handleBeforeContextMenu,
    // contextMenuPosition, handleContextMenuClose, handleContextMenuHide, isContextMenuOpen,
  } = useContextMenuHandlers(ref!, !contextActions);

  const {
    closeForumPanel, openForumPanel, openChat, focusLastMessage,
  } = getActions();

  // TODO
  const isForumPanelOpen = false;
  const isSelected = true;
  const canScrollDown = true;

  const handleClickChat = useLastCallbackTeact(() => {
    const chatId = item.id as string;
    if (item.isFolder) {
      if (isForumPanelOpen) {
        closeForumPanel(undefined, { forceOnHeavyAnimation: true });
      } else {
        openForumPanel({ chatId }, { forceOnHeavyAnimation: true });
      }

      return;
    }

    openChat({ id: chatId, shouldReplaceHistory: true }, { forceOnHeavyAnimation: true });

    if (isSelected && canScrollDown) {
      focusLastMessage();
    }
  });

  const { handleClick, handleMouseDown } = useFastClick((e: React.MouseEvent<HTMLDivElement>) => {
    if (contextActions && (e.button === MouseButton.Secondary)) {
      handleBeforeContextMenu(e);
    }

    if (e.type === 'mousedown' && e.button !== MouseButton.Main) {
      return;
    }

    handleClickChat();
  });

  // const getTriggerElement = useLastCallback(() => ref!.current);
  // const getRootElement = useLastCallback(
  //   () => (contextRootElementSelector ? ref!.current!.closest(contextRootElementSelector) : document.body),
  // );
  // const getMenuElement = useLastCallback(
  //   () => document.querySelector('#portals')!.querySelector('.Tab-context-menu .bubble'),
  // );
  // const getLayout = useLastCallback(() => ({ withPortal: true }));

  // const {
  //   positionX, positionY, transformOriginX, transformOriginY, style: menuStyle,
  // } = useMenuPosition(
  //   contextMenuPosition,
  //   getTriggerElement,
  //   getRootElement,
  //   getMenuElement,
  //   getLayout,
  // );

  // TODO use <ListItem/> with <Ripple/>
  return (
    <>
      <div
        className={classNameWrapper}
        ref={ref}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
        {...context.itemContainerWithChildrenProps}
        {...context.interactiveElementProps}
        // @ts-ignore
        style={{ maxHeight: `${ULU_APP.SIDEBAR_CHAT_FOLDERS_TREE_ITEM_HEIGHT_REM}rem` }}
      >
        <div className={buildClassName(stylesUluChatFolder.info, styles.info)}>
          <div className={stylesUluChatFolder.iconWrapper}>
            <ChatAvatar chat={item.chat!} />
          </div>
          <div className={buildClassName(styles.title, styles.dots)}>
            {title}
          </div>
        </div>
        { !!messagesUnreadCount && (<div className={stylesUluChatFolder.unread}>{ messagesUnreadCount }</div>) }
        {/* {contextActions && contextMenuPosition !== undefined && (
        // <Menu
        //   isOpen={isContextMenuOpen}
        //   transformOriginX={transformOriginX}
        //   transformOriginY={transformOriginY}
        //   positionX={positionX}
        //   positionY={positionY}
        //   // style={menuStyle}
        //   className="Tab-context-menu"
        //   autoClose
        //   onClose={handleContextMenuClose}
        //   onCloseAnimationEnd={handleContextMenuHide}
        //   withPortal
        // >
        //   {contextActions.map((action) => (
        //     ('isSeparator' in action) ? (
        //       <MenuSeparator key={action.key || 'separator'} />
        //     ) : (
        //       <MenuItem
        //         key={action.title}
        //         icon={action.icon}
        //         destructive={action.destructive}
        //         disabled={!action.handler}
        //         onClick={action.handler}
        //       >
        //         {action.title}
        //       </MenuItem>
        //     )
        //   ))}
        // </Menu>
      )} */}
      </div>
      {children}
    </>
  );
};

export default Chat;
