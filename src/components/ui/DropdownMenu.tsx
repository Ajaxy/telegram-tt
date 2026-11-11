import type { FC } from '../../lib/teact/teact';
import {
  useCallback, useMemo, useRef, useState,
} from '../../lib/teact/teact';

import type { MenuPositionOptions } from '../../hooks/useMenuPosition';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from './Button';
import Menu from './Menu';

import './DropdownMenu.scss';

type OwnProps = {
  className?: string;
  bubbleClassName?: string;
  trigger?: FC<{ onTrigger: () => void; isOpen?: boolean }>;
  transformOriginX?: number;
  transformOriginY?: number;
  positionX?: 'left' | 'right' | 'center';
  positionY?: 'top' | 'bottom';
  footer?: string;
  forceOpen?: boolean;
  withPortal?: boolean;
  onOpen?: NoneToVoidFunction;
  onClose?: NoneToVoidFunction;
  onHide?: NoneToVoidFunction;
  onTransitionEnd?: NoneToVoidFunction;
  onMouseEnterBackdrop?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  children: React.ReactNode;
  autoClose?: boolean;
};

const DropdownMenu = ({
  trigger,
  className,
  bubbleClassName,
  children,
  transformOriginX,
  transformOriginY,
  positionX = 'left',
  positionY,
  footer,
  forceOpen,
  withPortal,
  onOpen,
  onClose,
  onTransitionEnd,
  onMouseEnterBackdrop,
  onHide,
  autoClose = true,
}: OwnProps) => {
  const lang = useLang();

  const menuRef = useRef<HTMLDivElement>();
  const triggerRef = useRef<HTMLDivElement>();
  const [isOpen, setIsOpen] = useState(false);

  const toggleIsOpen = () => {
    setIsOpen(!isOpen);

    if (isOpen) {
      onClose?.();
    } else {
      onOpen?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<any>) => {
    const menu = menuRef.current;

    if (!isOpen || e.keyCode !== 40 || !menu) {
      return;
    }

    const focusedElement = menu.ownerDocument.activeElement;
    const elementChildren = Array.from(menu.children);

    if (!focusedElement || elementChildren.indexOf(focusedElement) === -1) {
      (elementChildren[0] as HTMLElement).focus();
    }
  };

  const handleClose = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const triggerComponent: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    if (trigger) return trigger;

    return ({ onTrigger, isOpen: isMenuOpen }) => (
      <Button
        round
        size="smaller"
        color="translucent"
        className={isMenuOpen ? 'active' : ''}
        iconName="more"
        onClick={onTrigger}
        ariaLabel={lang('AccDescrMoreOptions')}
      />
    );
  }, [trigger, lang]);

  const getTriggerElement = useLastCallback(() => triggerRef.current);
  const getAnchor = useLastCallback(() => {
    const rect = triggerRef.current!.getBoundingClientRect();
    return { x: rect.left, y: positionY === 'bottom' ? rect.top : rect.bottom };
  });
  const getRootElement = useLastCallback(() => triggerRef.current?.ownerDocument.documentElement);
  const getMenuElement = useLastCallback(() => menuRef.current);
  const getLayout = useLastCallback(() => ({ withPortal: true }));
  const positionOptions: MenuPositionOptions = withPortal ? {
    anchor: getAnchor,
    positionY,
    getTriggerElement,
    getRootElement,
    getMenuElement,
    getLayout,
  } : {
    positionX,
    positionY,
    transformOriginX,
    transformOriginY,
  };

  return (
    <div
      ref={triggerRef}
      className={`DropdownMenu ${className || ''}`}
      onKeyDown={handleKeyDown}
      onTransitionEnd={onTransitionEnd}
    >
      {triggerComponent({ onTrigger: toggleIsOpen, isOpen })}

      <Menu
        ref={menuRef}
        isOpen={isOpen || Boolean(forceOpen)}
        className={className || ''}
        bubbleClassName={bubbleClassName || ''}
        {...positionOptions}
        footer={footer}
        autoClose={autoClose}
        withPortal={withPortal}
        onClose={handleClose}
        onCloseAnimationEnd={onHide}
        onMouseEnterBackdrop={onMouseEnterBackdrop}
      >
        {children}
      </Menu>
    </div>
  );
};

export default DropdownMenu;
