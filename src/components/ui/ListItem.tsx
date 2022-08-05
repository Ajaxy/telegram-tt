import type { RefObject } from 'react';
import type { FC, TeactNode } from '../../lib/teact/teact';
import React, { useRef, useCallback } from '../../lib/teact/teact';

import { IS_TOUCH_ENV } from '../../util/environment';
import { fastRaf } from '../../util/schedulers';
import buildClassName from '../../util/buildClassName';
import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useContextMenuPosition from '../../hooks/useContextMenuPosition';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import RippleEffect from './RippleEffect';
import Menu from './Menu';
import MenuItem from './MenuItem';
import Button from './Button';

import './ListItem.scss';

interface MenuItemContextAction {
  title: string;
  icon: string;
  destructive?: boolean;
  handler?: () => void;
}

interface OwnProps {
  ref?: RefObject<HTMLDivElement>;
  buttonRef?: RefObject<HTMLDivElement>;
  icon?: string;
  leftElement?: TeactNode;
  secondaryIcon?: string;
  buttonClassName?: string;
  className?: string;
  style?: string;
  children: React.ReactNode;
  disabled?: boolean;
  ripple?: boolean;
  narrow?: boolean;
  inactive?: boolean;
  focus?: boolean;
  destructive?: boolean;
  multiline?: boolean;
  isStatic?: boolean;
  contextActions?: MenuItemContextAction[];
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onSecondaryIconClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onDragEnter?: (e: React.DragEvent<HTMLDivElement>) => void;
}

const ListItem: FC<OwnProps> = ({
  ref,
  buttonRef,
  icon,
  leftElement,
  buttonClassName,
  secondaryIcon,
  className,
  style,
  children,
  disabled,
  ripple,
  narrow,
  inactive,
  focus,
  destructive,
  multiline,
  isStatic,
  contextActions,
  onMouseDown,
  onClick,
  onSecondaryIconClick,
  onDragEnter,
}) => {
  // eslint-disable-next-line no-null/no-null
  let containerRef = useRef<HTMLDivElement>(null);
  if (ref) {
    containerRef = ref;
  }
  const [isTouched, markIsTouched, unmarkIsTouched] = useFlag();

  const {
    isContextMenuOpen, contextMenuPosition,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(containerRef, !contextActions);

  const getTriggerElement = useCallback(() => containerRef.current, []);

  const getRootElement = useCallback(
    () => containerRef.current!.closest('.custom-scroll'),
    [],
  );

  const getMenuElement = useCallback(
    () => containerRef.current!.querySelector('.ListItem-context-menu .bubble'),
    [],
  );

  const {
    positionX, positionY, transformOriginX, transformOriginY, style: menuStyle,
  } = useContextMenuPosition(
    contextMenuPosition,
    getTriggerElement,
    getRootElement,
    getMenuElement,
  );

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (disabled || !onClick) {
      return;
    }
    onClick(e);

    if (IS_TOUCH_ENV && !ripple) {
      markIsTouched();
      fastRaf(unmarkIsTouched);
    }
  }, [disabled, markIsTouched, onClick, ripple, unmarkIsTouched]);

  const handleSecondaryIconClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    if (disabled || e.button !== 0 || (!onSecondaryIconClick && !contextActions)) return;
    e.stopPropagation();
    if (onSecondaryIconClick) {
      onSecondaryIconClick(e);
    } else {
      handleContextMenu(e);
    }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (inactive || IS_TOUCH_ENV) {
      return;
    }
    if (contextActions && (e.button === 2 || !onClick)) {
      handleBeforeContextMenu(e);
    }
    if (e.button === 0) {
      if (!onClick) {
        handleContextMenu(e);
      } else {
        handleClick(e);
      }
    }
  }, [inactive, contextActions, onClick, handleBeforeContextMenu, handleContextMenu, handleClick]);

  const lang = useLang();

  const fullClassName = buildClassName(
    'ListItem',
    className,
    !isStatic && 'no-selection',
    ripple && 'has-ripple',
    narrow && 'narrow',
    disabled && 'disabled',
    inactive && 'inactive',
    contextMenuPosition && 'has-menu-open',
    focus && 'focus',
    destructive && 'destructive',
    multiline && 'multiline',
    isStatic && 'is-static',
  );

  return (
    <div
      ref={containerRef}
      className={fullClassName}
      dir={lang.isRtl ? 'rtl' : undefined}
      style={style}
      onMouseDown={onMouseDown}
      onDragEnter={onDragEnter}
    >
      <div
        className={buildClassName('ListItem-button', isTouched && 'active', buttonClassName)}
        role={!isStatic ? 'button' : undefined}
        ref={buttonRef}
        tabIndex={!isStatic ? 0 : undefined}
        onClick={(!inactive && IS_TOUCH_ENV) ? handleClick : undefined}
        onMouseDown={handleMouseDown}
        onContextMenu={(!inactive && contextActions) ? handleContextMenu : undefined}
      >
        {leftElement}
        {icon && (
          <i className={`icon-${icon}`} />
        )}
        {multiline && (<div className="multiline-item">{children}</div>)}
        {!multiline && children}
        {!disabled && !inactive && ripple && (
          <RippleEffect />
        )}
        {secondaryIcon && (
          <Button
            className="secondary-icon"
            round
            color="translucent"
            size="smaller"
            onClick={IS_TOUCH_ENV ? handleSecondaryIconClick : undefined}
            onMouseDown={!IS_TOUCH_ENV ? handleSecondaryIconClick : undefined}
          >
            <i className={`icon-${secondaryIcon}`} />
          </Button>
        )}
      </div>
      {contextActions && contextMenuPosition !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          transformOriginX={transformOriginX}
          transformOriginY={transformOriginY}
          positionX={positionX}
          positionY={positionY}
          style={menuStyle}
          className="ListItem-context-menu"
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
        >
          {contextActions.map((action) => (
            <MenuItem
              key={action.title}
              icon={action.icon}
              destructive={action.destructive}
              disabled={!action.handler}
              onClick={action.handler}
            >
              {action.title}
            </MenuItem>
          ))}
        </Menu>
      )}
    </div>
  );
};

export default ListItem;
