import type { RefObject } from 'react';
import type { FC, TeactNode } from '../../lib/teact/teact';
import React, { useRef } from '../../lib/teact/teact';

import type { IconName } from '../../types/icons';

import { requestMeasure } from '../../lib/fasterdom/fasterdom';
import buildClassName from '../../util/buildClassName';
import { IS_TOUCH_ENV, MouseButton } from '../../util/windowEnvironment';
import renderText from '../common/helpers/renderText';

import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import { useFastClick } from '../../hooks/useFastClick';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useMenuPosition from '../../hooks/useMenuPosition';

import Button from './Button';
import Menu from './Menu';
import MenuItem from './MenuItem';
import MenuSeparator from './MenuSeparator';
import RippleEffect from './RippleEffect';

import './ListItem.scss';

type MenuItemContextActionItem = {
  title: string;
  icon: IconName;
  destructive?: boolean;
  handler?: () => void;
};

type MenuItemContextActionSeparator = {
  isSeparator: true;
  key?: string;
};

export type MenuItemContextAction =
  MenuItemContextActionItem
  | MenuItemContextActionSeparator;

interface OwnProps {
  ref?: RefObject<HTMLDivElement>;
  buttonRef?: RefObject<HTMLDivElement | HTMLAnchorElement>;
  icon?: IconName;
  iconClassName?: string;
  leftElement?: TeactNode;
  secondaryIcon?: IconName;
  rightElement?: TeactNode;
  buttonClassName?: string;
  className?: string;
  shortcut?: string;
  style?: string;
  children: React.ReactNode;
  disabled?: boolean;
  allowDisabledClick?: boolean;
  ripple?: boolean;
  narrow?: boolean;
  inactive?: boolean;
  focus?: boolean;
  destructive?: boolean;
  multiline?: boolean;
  isStatic?: boolean;
  contextActions?: MenuItemContextAction[];
  withPortalForMenu?: boolean;
  menuBubbleClassName?: string;
  href?: string;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLElement>, arg?: any) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLElement>) => void;
  clickArg?: any;
  onSecondaryIconClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onDragEnter?: (e: React.DragEvent<HTMLDivElement>) => void;
}

const ListItem: FC<OwnProps> = ({
  ref,
  buttonRef,
  icon,
  iconClassName,
  leftElement,
  buttonClassName,
  menuBubbleClassName,
  secondaryIcon,
  rightElement,
  className,
  shortcut,
  style,
  children,
  disabled,
  allowDisabledClick,
  ripple,
  narrow,
  inactive,
  focus,
  destructive,
  multiline,
  isStatic,
  contextActions,
  withPortalForMenu,
  href,
  onMouseDown,
  onClick,
  onContextMenu,
  clickArg,
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

  const getTriggerElement = useLastCallback(() => containerRef.current);
  const getRootElement = useLastCallback(() => containerRef.current!.closest('.custom-scroll'));
  const getMenuElement = useLastCallback(() => {
    return (withPortalForMenu ? document.querySelector('#portals') : containerRef.current)!
      .querySelector('.ListItem-context-menu .bubble');
  });
  const getLayout = useLastCallback(() => ({ withPortal: withPortalForMenu }));

  const {
    positionX, positionY, transformOriginX, transformOriginY, style: menuStyle,
  } = useMenuPosition(
    contextMenuPosition,
    getTriggerElement,
    getRootElement,
    getMenuElement,
    getLayout,
  );

  const handleClickEvent = useLastCallback((e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    const hasModifierKey = e.ctrlKey || e.metaKey || e.shiftKey;
    if (!hasModifierKey && e.button === MouseButton.Main) {
      e.preventDefault();
    }
  });

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    if ((disabled && !allowDisabledClick) || !onClick) {
      return;
    }

    if (href) {
      // Allow default behavior for opening links in new tab
      const hasModifierKey = e.ctrlKey || e.metaKey || e.shiftKey;
      if ((hasModifierKey && e.button === MouseButton.Main) || e.button === MouseButton.Auxiliary) {
        return;
      }

      e.preventDefault();
    }

    onClick(e, clickArg);

    if (IS_TOUCH_ENV && !ripple) {
      markIsTouched();
      requestMeasure(unmarkIsTouched);
    }
  });

  const {
    handleClick: handleSecondaryIconClick,
    handleMouseDown: handleSecondaryIconMouseDown,
  } = useFastClick((e: React.MouseEvent<HTMLButtonElement>) => {
    if ((disabled && !allowDisabledClick) || e.button !== 0 || (!onSecondaryIconClick && !contextActions)) return;

    e.stopPropagation();

    if (onSecondaryIconClick) {
      onSecondaryIconClick(e);
    } else {
      handleContextMenu(e);
    }
  });

  const handleMouseDown = useLastCallback((e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    if (inactive || IS_TOUCH_ENV) {
      return;
    }
    if (contextActions && (e.button === MouseButton.Secondary || !onClick)) {
      handleBeforeContextMenu(e);
    }
    if (e.button === MouseButton.Main) {
      if (!onClick) {
        handleContextMenu(e);
      } else {
        handleClick(e);
      }
    }
  });

  const lang = useLang();

  const fullClassName = buildClassName(
    'ListItem',
    className,
    isStatic && 'allow-selection',
    ripple && 'has-ripple',
    narrow && 'narrow',
    disabled && 'disabled',
    allowDisabledClick && 'click-allowed',
    inactive && 'inactive',
    contextMenuPosition && 'has-menu-open',
    focus && 'focus',
    destructive && 'destructive',
    multiline && 'multiline',
    isStatic && 'is-static',
  );

  const ButtonElementTag = href ? 'a' : 'div';

  return (
    <div
      ref={containerRef}
      className={fullClassName}
      dir={lang.isRtl ? 'rtl' : undefined}
      style={style}
      onMouseDown={onMouseDown}
      onDragEnter={onDragEnter}
    >
      <ButtonElementTag
        className={buildClassName('ListItem-button', isTouched && 'active', buttonClassName)}
        role={!isStatic ? 'button' : undefined}
        href={href}
        ref={buttonRef as any /* TS requires specific types for refs */}
        tabIndex={!isStatic ? 0 : undefined}
        onClick={(!inactive && IS_TOUCH_ENV) ? handleClick : handleClickEvent}
        onMouseDown={handleMouseDown}
        onContextMenu={onContextMenu || ((!inactive && contextActions) ? handleContextMenu : undefined)}
      >
        {leftElement}
        {icon && (
          <i className={buildClassName('icon', `icon-${icon}`, iconClassName)} />
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
            onClick={handleSecondaryIconClick}
            onMouseDown={handleSecondaryIconMouseDown}
          >
            <i className={`icon icon-${secondaryIcon}`} />
          </Button>
        )}
        {shortcut && <span className="shortcut">{shortcut}</span>}
        {rightElement}
      </ButtonElementTag>
      {contextActions && contextMenuPosition !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          transformOriginX={transformOriginX}
          transformOriginY={transformOriginY}
          positionX={positionX}
          positionY={positionY}
          style={menuStyle}
          className="ListItem-context-menu with-menu-transitions"
          autoClose
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
          withPortal={withPortalForMenu}
          bubbleClassName={menuBubbleClassName}
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
                <span className="list-item-ellipsis">
                  {renderText(action.title)}
                </span>
              </MenuItem>
            )
          ))}
        </Menu>
      )}
    </div>
  );
};

export default ListItem;
