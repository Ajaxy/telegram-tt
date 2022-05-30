import type { FC } from '../../lib/teact/teact';
import React, { useState, useRef, useCallback } from '../../lib/teact/teact';

import Menu from './Menu';

import './DropdownMenu.scss';

type OwnProps = {
  className?: string;
  trigger: FC<{ onTrigger: () => void; isOpen?: boolean }>;
  positionX?: 'left' | 'right';
  positionY?: 'top' | 'bottom';
  footer?: string;
  forceOpen?: boolean;
  onOpen?: NoneToVoidFunction;
  onClose?: NoneToVoidFunction;
  children: React.ReactNode;
};

const DropdownMenu: FC<OwnProps> = ({
  trigger,
  className,
  children,
  positionX = 'left',
  positionY = 'top',
  footer,
  forceOpen,
  onOpen,
  onClose,
}) => {
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const toggleIsOpen = () => {
    setIsOpen(!isOpen);
    if (isOpen) {
      if (onClose) onClose();
    } else if (onOpen) onOpen();
  };

  const handleKeyDown = (e: React.KeyboardEvent<any>) => {
    const menu = menuRef.current;

    if (!isOpen || e.keyCode !== 40 || !menu) {
      return;
    }

    const focusedElement = document.activeElement;
    const elementChildren = Array.from(menu.children);

    if (!focusedElement || elementChildren.indexOf(focusedElement) === -1) {
      (elementChildren[0] as HTMLElement).focus();
    }
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (onClose) onClose();
  }, [onClose]);

  return (
    <div
      ref={dropdownRef}
      className={`DropdownMenu ${className || ''}`}
      onKeyDown={handleKeyDown}
    >
      {trigger({ onTrigger: toggleIsOpen, isOpen })}

      <Menu
        ref={menuRef}
        containerRef={dropdownRef}
        isOpen={isOpen || Boolean(forceOpen)}
        className={className || ''}
        positionX={positionX}
        positionY={positionY}
        footer={footer}
        autoClose
        onClose={handleClose}
        shouldSkipTransition={forceOpen}
      >
        {children}
      </Menu>
    </div>
  );
};

export default DropdownMenu;
