/* eslint-disable react/jsx-props-no-spreading */
import type { ReactNode } from 'react';
import React, { useCallback } from 'react';
import type { TreeItemRenderContext } from 'react-complex-tree';
import type { FC } from '../../../../../../lib/teact/teact';
import { getActions } from '../../../../../../global';

import type { TreeItemChat } from '../../types';

import { ULU_APP } from '../../../../../../config';
import buildClassName from '../../../../../../util/buildClassName';
import { MouseButton } from '../../../../../../util/windowEnvironment';

import useContextMenuHandlers from '../../../../../../hooks/useContextMenuHandlers.react';
import { useFastClick } from '../../../../../../hooks/useFastClick.react';
import useLastCallback from '../../../../../../hooks/useLastCallback.react';
import useMenuPosition from '../../../../../../hooks/useMenuPosition.react';

import Menu from '../../../../../ui/Menu.react';
import MenuItem from '../../../../../ui/MenuItem.react';
import MenuSeparator from '../../../../../ui/MenuSeparator.react';
import SvgFolderClosed from './SvgFolderClosed';
import SvgFolderOpen from './SvgFolderOpen';

import stylesUluChatFolder from '../../../UluChatFolder/UluChatFolder.module.scss';
import styles from './ChatFolder.module.scss';

const ChatFolder: FC<{
  children: ReactNode;
  item: TreeItemChat<any>;
  context: TreeItemRenderContext<never>;
  title: string | ReactNode;
  active: boolean | undefined;
  expanded?: boolean;
  shouldStressUnreadMessages: boolean;
  contextRootElementSelector?: string;
  onClick?: (arg: string | number) => void;
}> = ({
  children, active, expanded, title, shouldStressUnreadMessages, item, context, onClick, contextRootElementSelector,
}) => {
  const {
    contextActions, index, unreadCount: messagesUnreadCount, ref,
  } = item;

  const classNameWrapper = buildClassName(
    stylesUluChatFolder.wrapper,
    active && stylesUluChatFolder.active,
    !!messagesUnreadCount && shouldStressUnreadMessages && stylesUluChatFolder['has-unread-messages'],
  );
  const svgFill = active ? 'var(--color-white)' : 'var(--color-gray)';
  const [SvgComponent, svgComponentProps] = expanded
    ? [SvgFolderOpen, { height: 17, width: 20 }]
    : [SvgFolderClosed, { height: 17, width: 18 }];

  const {
    handleContextMenu, handleBeforeContextMenu,
    contextMenuPosition, handleContextMenuClose, handleContextMenuHide, isContextMenuOpen,
  } = useContextMenuHandlers(ref!, !contextActions);

  const {
    setActiveChatFolder,
  } = getActions();

  const handleClickFolder = useCallback(() => {
    setActiveChatFolder({ activeChatFolder: index as number }, { forceOnHeavyAnimation: true });
  }, [index]);

  const { handleClick, handleMouseDown } = useFastClick((e: React.MouseEvent<HTMLDivElement>) => {
    if (contextActions && (e.button === MouseButton.Secondary || !onClick)) {
      handleBeforeContextMenu(e);
    }

    if (e.type === 'mousedown' && e.button !== MouseButton.Main) {
      return;
    }

    handleClickFolder();
  });

  const getTriggerElement = useLastCallback(() => ref!.current);
  const getRootElement = useLastCallback(
    () => (contextRootElementSelector ? ref!.current!.closest(contextRootElementSelector) : document.body),
  );
  const getMenuElement = useLastCallback(
    () => document.querySelector('#portals')!.querySelector('.Tab-context-menu .bubble'),
  );
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const {
    positionX, positionY, transformOriginX, transformOriginY, style: menuStyle,
  } = useMenuPosition(
    contextMenuPosition,
    getTriggerElement,
    getRootElement,
    getMenuElement,
    getLayout,
  );

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
            <SvgComponent
              {...svgComponentProps}
              fill={svgFill}
            />
          </div>
          <div className={buildClassName(styles.title, styles.dots)}>
            {title}
          </div>
        </div>
        { !!messagesUnreadCount && (<div className={stylesUluChatFolder.unread}>{ messagesUnreadCount }</div>) }
        {contextActions && contextMenuPosition !== undefined && (
          <Menu
            isOpen={isContextMenuOpen}
            transformOriginX={transformOriginX}
            transformOriginY={transformOriginY}
            positionX={positionX}
            positionY={positionY}
            style={menuStyle}
            className="Tab-context-menu"
            autoClose
            onClose={handleContextMenuClose}
            onCloseAnimationEnd={handleContextMenuHide}
            withPortal
          >
            {contextActions.map((action) => (
              ('isSeparator' in action) ? (
                <MenuSeparator key={action.key || 'separator'} />
              ) : (
                <MenuItem
                  key={action.title}
                  icon={action.icon}
                  destructive={action.destructive}
                  disabled={!action.handler}
                  onClick={action.handler}
                >
                  {action.title}
                </MenuItem>
              )
            ))}
          </Menu>
        )}
      </div>
      {children}
    </>
  );
};

export default ChatFolder;
