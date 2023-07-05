import type { RefObject } from 'react';
import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useRef } from '../../lib/teact/teact';

import { IS_BACKDROP_BLUR_SUPPORTED } from '../../util/windowEnvironment';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import { preventMessageInputBlurWithBubbling } from '../middle/helpers/preventMessageInputBlur';
import useShowTransition from '../../hooks/useShowTransition';
import useKeyboardListNavigation from '../../hooks/useKeyboardListNavigation';
import useVirtualBackdrop from '../../hooks/useVirtualBackdrop';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useHistoryBack from '../../hooks/useHistoryBack';
import useAppLayout from '../../hooks/useAppLayout';

import Portal from './Portal';

import './Menu.scss';

type OwnProps = {
  ref?: RefObject<HTMLDivElement>;
  containerRef?: RefObject<HTMLElement>;
  isOpen: boolean;
  shouldCloseFast?: boolean;
  id?: string;
  className?: string;
  bubbleClassName?: string;
  style?: string;
  bubbleStyle?: string;
  ariaLabelledBy?: string;
  transformOriginX?: number;
  transformOriginY?: number;
  positionX?: 'left' | 'right';
  positionY?: 'top' | 'bottom';
  autoClose?: boolean;
  shouldSkipTransition?: boolean;
  footer?: string;
  noCloseOnBackdrop?: boolean;
  backdropExcludedSelector?: string;
  noCompact?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<any>) => void;
  onCloseAnimationEnd?: () => void;
  onClose: () => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onMouseEnterBackdrop?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  withPortal?: boolean;
  children: React.ReactNode;
};

const ANIMATION_DURATION = 200;

const Menu: FC<OwnProps> = ({
  ref,
  containerRef,
  shouldCloseFast,
  isOpen,
  id,
  className,
  bubbleClassName,
  style,
  bubbleStyle,
  ariaLabelledBy,
  children,
  transformOriginX,
  transformOriginY,
  positionX = 'left',
  positionY = 'top',
  autoClose = false,
  footer,
  noCloseOnBackdrop = false,
  backdropExcludedSelector,
  noCompact,
  onCloseAnimationEnd,
  onClose,
  onMouseEnter,
  onMouseLeave,
  shouldSkipTransition,
  withPortal,
  onMouseEnterBackdrop,
}) => {
  // eslint-disable-next-line no-null/no-null
  let menuRef = useRef<HTMLDivElement>(null);
  if (ref) {
    menuRef = ref;
  }
  const backdropContainerRef = containerRef || menuRef;
  const { isTouchScreen } = useAppLayout();

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
    () => (isOpen ? captureEscKeyListener(onClose) : undefined),
    [isOpen, onClose],
  );

  useHistoryBack({
    isActive: isOpen,
    onBack: onClose,
    shouldBeReplaced: true,
  });

  useEffectWithPrevDeps(([prevIsOpen]) => {
    if (isOpen || (!isOpen && prevIsOpen === true)) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION);
    }
  }, [isOpen]);

  const handleKeyDown = useKeyboardListNavigation(menuRef, isOpen, autoClose ? onClose : undefined, undefined, true);

  useVirtualBackdrop(
    isOpen,
    backdropContainerRef,
    noCloseOnBackdrop ? undefined : onClose,
    undefined,
    backdropExcludedSelector,
  );

  const bubbleFullClassName = buildClassName(
    'bubble menu-container custom-scroll',
    positionY,
    positionX,
    footer && 'with-footer',
    transitionClassNames,
    bubbleClassName,
    shouldCloseFast && 'close-fast',
  );

  const transformOriginYStyle = transformOriginY !== undefined ? `${transformOriginY}px` : undefined;
  const transformOriginXStyle = transformOriginX !== undefined ? `${transformOriginX}px` : undefined;

  const menu = (
    <div
      id={id}
      className={buildClassName(
        'Menu no-selection',
        !noCompact && !isTouchScreen && 'compact',
        !IS_BACKDROP_BLUR_SUPPORTED && 'no-blur',
        className,
      )}
      style={style}
      aria-labelledby={ariaLabelledBy}
      role={ariaLabelledBy ? 'menu' : undefined}
      onKeyDown={isOpen ? handleKeyDown : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={isOpen ? onMouseLeave : undefined}
    >
      {isOpen && (
        // This only prevents click events triggering on underlying elements
        <div
          className="backdrop"
          onMouseDown={preventMessageInputBlurWithBubbling}
          onMouseEnter={onMouseEnterBackdrop}
        />
      )}
      <div
        role="presentation"
        ref={menuRef}
        className={bubbleFullClassName}
        style={buildStyle(
          `transform-origin: ${transformOriginXStyle || positionX} ${transformOriginYStyle || positionY}`,
          bubbleStyle,
        )}
        onClick={autoClose ? onClose : undefined}
      >
        {children}
        {footer && <div className="footer">{footer}</div>}
      </div>
    </div>
  );

  if (withPortal) {
    return <Portal>{menu}</Portal>;
  }

  return menu;
};

export default memo(Menu);
