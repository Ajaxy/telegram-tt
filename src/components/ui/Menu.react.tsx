import React, {
  memo,
  useEffect,
  useRef,
} from 'react';
import type { FC } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import freezeWhenClosed from '../../util/hoc/freezeWhenClosed.react';
import { IS_BACKDROP_BLUR_SUPPORTED } from '../../util/windowEnvironment';
import { preventMessageInputBlurWithBubbling } from '../middle/helpers/preventMessageInputBlur';

import useAppLayout from '../../hooks/useAppLayout.react';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps.react';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck.react';
import useHistoryBack from '../../hooks/useHistoryBack.react';
import useKeyboardListNavigation from '../../hooks/useKeyboardListNavigation.react';
import useShowTransition from '../../hooks/useShowTransition.react';
import useVirtualBackdrop from '../../hooks/useVirtualBackdrop.react';

import Portal from './Portal.react';

import './Menu.scss';

type OwnProps = {
  ref?: React.RefObject<HTMLDivElement>;
  containerRef?: React.RefObject<HTMLElement>;
  isOpen: boolean;
  shouldCloseFast?: boolean;
  id?: string;
  className?: string;
  bubbleClassName?: string;
  style?: object;
  bubbleStyle?: object;
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
  portalContainerId?: string;
  portalElementId?: string;
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
  bubbleStyle = {},
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
  portalContainerId,
  portalElementId,
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

  // TODO this is a clutch
  // upstream doesn't require this
  // figure out later if this becomes a problem
  useEffect(() => {
    if (!isOpen) return;

    setTimeout(() => {
      // @ts-ignore
      menuRef.current?.childNodes?.[0]?.focus();
    }, 10);
  }, [isOpen]);

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

  // eslint-disable-next-line react/no-unstable-nested-components
  const MenuComponent = () => (
    <div
      id={id}
      className={buildClassName(
        'Menu',
        !noCompact && !isTouchScreen && 'compact',
        !IS_BACKDROP_BLUR_SUPPORTED && 'no-blur',
        withPortal && 'in-portal',
        className,
      )}
      // @ts-ignore
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
        // @ts-ignore
        style={{
          transformOrigin: `${transformOriginXStyle || positionX} ${transformOriginYStyle || positionY}`,
          ...bubbleStyle,
        }}
        onClick={autoClose ? onClose : undefined}
      >
        {children}
        {footer && <div className="footer">{footer}</div>}
      </div>
    </div>
  );

  if (withPortal) {
    return <Portal elementId={portalElementId} containerId={portalContainerId}><MenuComponent /></Portal>;
  }

  return MenuComponent;
};

export default memo(freezeWhenClosed(Menu));
