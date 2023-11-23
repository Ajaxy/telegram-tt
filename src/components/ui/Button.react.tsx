import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import React, { useRef, useState } from 'react';
import type { FC } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import { IS_TOUCH_ENV, MouseButton } from '../../util/windowEnvironment';

import useLastCallback from '../../hooks/useLastCallback.react';

import RippleEffect from './RippleEffect.react';
import Spinner from './Spinner.react';

import './Button.scss';

export type OwnProps = {
  ref?: RefObject<HTMLButtonElement | HTMLAnchorElement>;
  type?: 'button' | 'submit' | 'reset';
  children: React.ReactNode;
  size?: 'default' | 'smaller' | 'tiny';
  color?: (
    'primary' | 'secondary' | 'gray' | 'danger' | 'translucent' | 'translucent-white' | 'translucent-black'
    | 'translucent-bordered' | 'dark' | 'green'
  );
  backgroundImage?: string;
  id?: string;
  className?: string;
  round?: boolean;
  pill?: boolean;
  fluid?: boolean;
  isText?: boolean;
  isLoading?: boolean;
  ariaLabel?: string;
  ariaControls?: string;
  hasPopup?: boolean;
  href?: string;
  download?: string;
  disabled?: boolean;
  allowDisabledClick?: boolean;
  noFastClick?: boolean;
  ripple?: boolean;
  faded?: boolean;
  tabIndex?: number;
  isRtl?: boolean;
  isShiny?: boolean;
  isRectangular?: boolean;
  withPremiumGradient?: boolean;
  noPreventDefault?: boolean;
  shouldStopPropagation?: boolean;
  style?: object;
  onClick?: (e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onContextMenu?: (e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onMouseDown?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  onMouseUp?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  onMouseEnter?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: NoneToVoidFunction;
  onFocus?: NoneToVoidFunction;
  onTransitionEnd?: NoneToVoidFunction;
};

// Longest animation duration;
const CLICKED_TIMEOUT = 400;

const Button: FC<OwnProps> = ({
  ref,
  type = 'button',
  id,
  onClick,
  onContextMenu,
  onMouseDown,
  onMouseUp,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  children,
  size = 'default',
  color = 'primary',
  backgroundImage,
  className,
  round,
  pill,
  fluid,
  isText,
  isLoading,
  isShiny,
  withPremiumGradient,
  onTransitionEnd,
  ariaLabel,
  ariaControls,
  hasPopup,
  href,
  download,
  disabled,
  allowDisabledClick,
  noFastClick = color === 'danger',
  ripple,
  faded,
  tabIndex,
  isRtl,
  isRectangular,
  noPreventDefault,
  shouldStopPropagation,
  style,
}) => {
  // eslint-disable-next-line no-null/no-null
  let elementRef = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  if (ref) {
    elementRef = ref;
  }

  const [isClicked, setIsClicked] = useState(false);

  const fullClassName = buildClassName(
    'Button',
    className,
    size,
    color,
    round && 'round',
    pill && 'pill',
    fluid && 'fluid',
    disabled && 'disabled',
    allowDisabledClick && 'click-allowed',
    isText && 'text',
    isLoading && 'loading',
    ripple && 'has-ripple',
    faded && 'faded',
    isClicked && 'clicked',
    backgroundImage && 'with-image',
    isShiny && 'shiny',
    withPremiumGradient && 'premium',
    isRectangular && 'rectangular',
  );

  const handleClick = useLastCallback((e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => {
    if ((allowDisabledClick || !disabled) && onClick) {
      onClick(e);
    }

    if (shouldStopPropagation) e.stopPropagation();

    setIsClicked(true);
    setTimeout(() => {
      setIsClicked(false);
    }, CLICKED_TIMEOUT);
  });

  const handleMouseDown = useLastCallback((e: ReactMouseEvent<HTMLButtonElement>) => {
    if (!noPreventDefault) e.preventDefault();

    if ((allowDisabledClick || !disabled) && onMouseDown) {
      onMouseDown(e);
    }

    if (!IS_TOUCH_ENV && e.button === MouseButton.Main && !noFastClick) {
      handleClick(e);
    }
  });

  if (href) {
    return (
      <a
        ref={elementRef as RefObject<HTMLAnchorElement>}
        id={id}
        className={fullClassName}
        href={href}
        title={ariaLabel}
        download={download}
        tabIndex={tabIndex}
        dir={isRtl ? 'rtl' : undefined}
        aria-label={ariaLabel}
        aria-controls={ariaControls}
        // @ts-ignore
        style={style}
        onTransitionEnd={onTransitionEnd}
      >
        {children}
        {!disabled && ripple && (
          <RippleEffect />
        )}
      </a>
    );
  }

  const buttonStyle = {
    ...(style || {}),
    ...(backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : {}),
  };

  return (
    <button
      ref={elementRef as RefObject<HTMLButtonElement>}
      id={id}
      type={type}
      className={fullClassName}
      onClick={IS_TOUCH_ENV || noFastClick ? handleClick : undefined}
      onContextMenu={onContextMenu}
      onMouseDown={handleMouseDown}
      onMouseUp={onMouseUp}
      onMouseEnter={onMouseEnter && !disabled ? onMouseEnter : undefined}
      onMouseLeave={onMouseLeave && !disabled ? onMouseLeave : undefined}
      onTransitionEnd={onTransitionEnd}
      onFocus={onFocus && !disabled ? onFocus : undefined}
      aria-label={ariaLabel}
      aria-controls={ariaControls}
      aria-haspopup={hasPopup}
      title={ariaLabel}
      tabIndex={tabIndex}
      dir={isRtl ? 'rtl' : undefined}
      // @ts-ignore
      style={buttonStyle}
    >
      {isLoading ? (
        <div>
          <span dir={isRtl ? 'auto' : undefined}>Please wait...</span>
          <Spinner color={isText ? 'blue' : 'white'} />
        </div>
      ) : children}
      {!disabled && ripple && (
        <RippleEffect />
      )}
    </button>
  );
};

export default Button;
