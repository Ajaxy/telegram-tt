/* eslint-disable react/jsx-props-no-spreading */
import type { ReactNode, RefObject } from 'react';
import React from 'react';
import type { TreeInformation, TreeItemRenderContext } from 'react-complex-tree';
import type { FC } from '../../../../../../lib/teact/teact';
import { getActions } from '../../../../../../lib/teact/teactn';

import type { TreeItemChat } from '../../types';

import { ULU_APP } from '../../../../../../config';
import buildClassName from '../../../../../../util/buildClassName';
import { MouseButton } from '../../../../../../util/windowEnvironment';

import useContextMenuHandlers from '../../../../../../hooks/useContextMenuHandlers';
import { useFastClick } from '../../../../../../hooks/useFastClick';
import useLastCallback from '../../../../../../hooks/useLastCallback';

// import useMenuPosition from '../../../../../../hooks/useMenuPosition';
// import Menu from './ContextMenu/Menu';
// import MenuItem from './ContextMenu/MenuItem';
// import MenuSeparator from './ContextMenu/MenuSeparator';
import SvgFolderClosed from './SvgFolderClosed';
import SvgFolderOpen from './SvgFolderOpen';

import styles from '../../../UluChatFolder/UluChatFolder.module.scss';

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

const TreeUluChatFolder: FC<{
  children: React.ReactNode;
  item: TreeItemChat<any>;
  context: TreeItemRenderContext<never>;
  title: string | ReactNode;
  active: boolean | undefined;
  expanded?: boolean;
  shouldStressUnreadMessages: boolean;
  contextRootElementSelector?: string;
  onClick?: (arg: string | number) => void;
}> = ({
  children, active, expanded, title, shouldStressUnreadMessages, item, context, onClick,
}) => {
  const {
    contextActions, index, unreadCount: messagesUnreadCount, ref,
  } = item;

  const classNameWrapper = buildClassName(
    styles.wrapper,
    active && styles.active,
    !!messagesUnreadCount && shouldStressUnreadMessages && styles['has-unread-messages'],
  );
  const svgFill = active ? 'var(--color-white)' : 'var(--color-gray)';
  const SvgComponent = expanded ? SvgFolderOpen : SvgFolderClosed;

  const {
    handleContextMenu, handleBeforeContextMenu,
    // contextMenuPosition, handleContextMenuClose, handleContextMenuHide, isContextMenuOpen,
  } = useContextMenuHandlers(ref!, !contextActions);

  const { handleClick, handleMouseDown } = useFastClick((e: React.MouseEvent<HTMLDivElement>) => {
    if (contextActions && (e.button === MouseButton.Secondary || !onClick)) {
      handleBeforeContextMenu(e);
    }

    if (e.type === 'mousedown' && e.button !== MouseButton.Main) {
      return;
    }

    onClick?.(index);
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
        <div className={styles.info}>
          <div className={styles.iconWrapper}>
            <SvgComponent
              height="1.25rem"
              width="1.25rem"
              fill={svgFill}
            />
          </div>
          <div className={styles.title}>
            {title}
          </div>
        </div>
        { !!messagesUnreadCount && (<div className={styles.unread}>{ messagesUnreadCount }</div>) }
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

const TreeItemComponent: FC<OwnProps> = ({
  title, item, context, children,
}) => {
  const {
    setActiveChatFolder,
  } = getActions();

  const handleSwitchFolder = useLastCallback((index: number | string) => {
    setActiveChatFolder({ activeChatFolder: index }, { forceOnHeavyAnimation: true });
  });

  return (
    <TreeUluChatFolder
      onClick={handleSwitchFolder}
      item={item}
      context={context}
      active={context.isSelected}
      expanded={context.isExpanded}
      shouldStressUnreadMessages={false}
      title={title}
    >
      {children}
    </TreeUluChatFolder>
  );
};

export default TreeItemComponent;
