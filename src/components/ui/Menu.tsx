import { RefObject } from 'react';
import React, { FC, useEffect, useRef } from '../../lib/teact/teact';

import useShowTransition from '../../hooks/useShowTransition';
import useKeyboardListNavigation from '../../hooks/useKeyboardListNavigation';
import useVirtualBackdrop from '../../hooks/useVirtualBackdrop';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import buildClassName from '../../util/buildClassName';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';

import './Menu.scss';

type OwnProps = {
  ref?: RefObject<HTMLDivElement>;
  containerRef?: RefObject<HTMLElement>;
  isOpen: boolean;
  className?: string;
  style?: string;
  positionX?: 'left' | 'right';
  positionY?: 'top' | 'bottom';
  autoClose?: boolean;
  shouldSkipTransition?: boolean;
  footer?: string;
  noCloseOnBackdrop?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<any>) => void;
  onCloseAnimationEnd?: () => void;
  onClose?: () => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  children: any;
};

const ANIMATION_DURATION = 200;

const Menu: FC<OwnProps> = ({
  ref,
  containerRef,
  isOpen,
  className,
  style,
  children,
  positionX = 'left',
  positionY = 'top',
  autoClose = false,
  footer,
  noCloseOnBackdrop = false,
  onCloseAnimationEnd,
  onClose,
  onMouseEnter,
  onMouseLeave,
  shouldSkipTransition,
}) => {
  // eslint-disable-next-line no-null/no-null
  let menuRef = useRef<HTMLDivElement>(null);
  if (ref) {
    menuRef = ref;
  }
  const backdropContainerRef = containerRef || menuRef;

  const {
    transitionClassNames,
  } = useShowTransition(
    isOpen,
    onCloseAnimationEnd,
    shouldSkipTransition,
    undefined,
    shouldSkipTransition,
  );

  useEffect(
    () => (isOpen && onClose ? captureEscKeyListener(onClose) : undefined),
    [isOpen, onClose],
  );

  useEffectWithPrevDeps(([prevIsOpen]) => {
    if (prevIsOpen !== undefined) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION);
    }
  }, [isOpen]);

  const handleKeyDown = useKeyboardListNavigation(menuRef, isOpen, autoClose ? onClose : undefined, undefined, true);

  useVirtualBackdrop(
    isOpen,
    backdropContainerRef,
    noCloseOnBackdrop ? undefined : onClose,
  );

  const bubbleClassName = buildClassName(
    'bubble menu-container custom-scroll',
    positionY,
    positionX,
    footer && 'with-footer',
    transitionClassNames,
  );

  return (
    <div
      className={buildClassName('Menu no-selection', className)}
      onKeyDown={isOpen ? handleKeyDown : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={isOpen ? onMouseLeave : undefined}
      // @ts-ignore teact feature
      style={style}
    >
      {isOpen && (
        // This only prevents click events triggering on underlying elements
        <div className="backdrop" />
      )}
      <div
        ref={menuRef}
        className={bubbleClassName}
        // @ts-ignore teact feature
        style={`transform-origin: ${positionY} ${positionX}`}
        onClick={autoClose ? onClose : undefined}
      >
        {children}
        {footer && <div className="footer">{footer}</div>}
      </div>
    </div>
  );
};

export default Menu;
