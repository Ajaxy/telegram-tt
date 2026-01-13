import {
  useEffect, useRef, useState, useUnmountCleanup,
} from '@teact';

import type { IAnchorPosition } from '../../types';
import type { IconName } from '../../types/icons';

import { requestMeasure } from '../../lib/fasterdom/fasterdom';
import buildClassName from '../../util/buildClassName';
import { REM } from '../common/helpers/mediaDimensions';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useUniqueId from '../../hooks/useUniqueId';
import useWindowSize from '../../hooks/window/useWindowSize';

import Icon from '../common/icons/Icon';
import Menu from './Menu';
import MenuItem from './MenuItem';

const OPEN_TIMEOUT = 150;
const CLOSE_TIMEOUT = 150;

type OwnProps = {
  icon?: IconName;
  customIcon?: React.ReactNode;
  submenuIcon?: IconName;
  className?: string;
  children: React.ReactNode;
  submenu: React.ReactNode;
  submenuClassName?: string;
  disabled?: boolean;
  destructive?: boolean;
  ariaLabel?: string;
  footer?: string;
};

const NestedMenuItem = ({
  icon,
  customIcon,
  submenuIcon,
  className,
  children,
  submenu,
  submenuClassName,
  disabled,
  destructive,
  ariaLabel,
  footer,
}: OwnProps) => {
  const lang = useLang();

  const itemRef = useRef<HTMLDivElement>();
  const closeTimeoutRef = useRef<number>();
  const openTimeoutRef = useRef<number>();
  const submenuId = useUniqueId();
  const isClosingRef = useRef(false);

  const [isSubmenuOpen, openSubmenu, closeSubmenu] = useFlag(false);

  useUnmountCleanup(() => {
    clearTimeout(closeTimeoutRef.current);
    clearTimeout(openTimeoutRef.current);
  });

  const [submenuAnchor, setSubmenuAnchor] = useState<IAnchorPosition>();
  const { isResizing } = useWindowSize();

  const updateAnchor = useLastCallback(() => {
    requestMeasure(() => {
      if (!itemRef.current) return;

      const rect = itemRef.current.getBoundingClientRect();
      const overlap = REM;

      setSubmenuAnchor({
        x: lang.isRtl ? rect.left + overlap : rect.right - overlap,
        y: rect.top,
        width: rect.width - overlap * 2,
        height: rect.height,
      });
    });
  });

  useEffect(() => {
    if (isSubmenuOpen && !isResizing) {
      updateAnchor();
    }
  }, [isSubmenuOpen, lang.isRtl, updateAnchor, isResizing]);

  const cancelOpen = useLastCallback(() => {
    clearTimeout(openTimeoutRef.current);
    openTimeoutRef.current = undefined;
  });

  const cancelClose = useLastCallback(() => {
    clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = undefined;
  });

  const scheduleOpen = useLastCallback(() => {
    cancelClose();
    cancelOpen();
    openTimeoutRef.current = window.setTimeout(() => {
      openTimeoutRef.current = undefined;
      // Don't open if the parent menu is closing
      const parentBubble = itemRef.current?.closest('.bubble');
      if (parentBubble?.classList.contains('closing')) return;
      openSubmenu();
    }, OPEN_TIMEOUT);
  });

  const scheduleClose = useLastCallback(() => {
    cancelOpen();
    cancelClose();
    closeTimeoutRef.current = window.setTimeout(() => {
      closeSubmenu();
      closeTimeoutRef.current = undefined;
    }, CLOSE_TIMEOUT);
  });

  const handleMouseEnter = useLastCallback(() => {
    if (disabled) return;
    scheduleOpen();
  });

  const handleSubmenuMouseEnter = useLastCallback(() => {
    cancelOpen();
    cancelClose();
  });

  const handleSubmenuMouseLeave = useLastCallback(() => {
    scheduleClose();
  });

  const closeParentMenu = useLastCallback(() => {
    const parentMenu = itemRef.current?.closest('.Menu');
    if (parentMenu) {
      const backdrop = parentMenu.querySelector('.backdrop') as HTMLElement;
      if (backdrop) {
        const event = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        backdrop.dispatchEvent(event);
      }
    }
  });

  const handleSubmenuClose = useLastCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    cancelOpen();
    cancelClose();
    closeSubmenu();

    closeParentMenu();

    // Reset after a short delay
    setTimeout(() => {
      isClosingRef.current = false;
    }, 100);
  });

  const getTriggerElement = useLastCallback(() => itemRef.current);
  const getRootElement = useLastCallback(() => document.body);
  const getMenuElement = useLastCallback(
    () => document.getElementById(submenuId)?.querySelector('.bubble') as HTMLElement | undefined,
  );
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const handleClick = useLastCallback((e: React.SyntheticEvent<HTMLDivElement | HTMLAnchorElement>) => {
    e.stopPropagation();
    if (disabled || isSubmenuOpen) return;
    openSubmenu();
  });

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={scheduleClose}
      ref={itemRef}
    >
      <MenuItem
        icon={icon}
        customIcon={customIcon}
        className={buildClassName(className, 'submenu')}
        disabled={disabled}
        destructive={destructive}
        ariaLabel={ariaLabel}
        onClick={handleClick}
      >
        {children}
        <Icon name={submenuIcon || (lang.isRtl ? 'previous' : 'next')} className="submenu-icon" />
        {submenuAnchor && (
          <Menu
            id={submenuId}
            isOpen={isSubmenuOpen}
            className={buildClassName('submenu', submenuClassName)}
            anchor={submenuAnchor}
            positionX={lang.isRtl ? 'left' : 'right'}
            getTriggerElement={getTriggerElement}
            getRootElement={getRootElement}
            getMenuElement={getMenuElement}
            getLayout={getLayout}
            autoClose
            nested
            withPortal
            footer={footer}
            onClose={handleSubmenuClose}
            onMouseEnter={handleSubmenuMouseEnter}
            onMouseLeave={handleSubmenuMouseLeave}
          >
            {submenu}
          </Menu>
        )}
      </MenuItem>
    </div>
  );
};

export default NestedMenuItem;
