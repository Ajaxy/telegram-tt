import { MouseEvent as ReactMouseEvent, RefObject } from 'react';

import React, {
  FC, useRef, useCallback, useState,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import Spinner from './Spinner';
import RippleEffect from './RippleEffect';

import './Button.scss';

export type OwnProps = {
  ref?: RefObject<HTMLButtonElement | HTMLAnchorElement>;
  type?: 'button' | 'submit' | 'reset';
  children: any;
  size?: 'default' | 'smaller' | 'tiny';
  color?: 'primary' | 'secondary' | 'gray' | 'danger' | 'translucent' | 'translucent-white' | 'dark';
  backgroundImage?: string;
  className?: string;
  round?: boolean;
  pill?: boolean;
  fluid?: boolean;
  isText?: boolean;
  isLoading?: boolean;
  ariaLabel?: string;
  href?: string;
  download?: string;
  disabled?: boolean;
  ripple?: boolean;
  faded?: boolean;
  tabIndex?: number;
  isRtl?: boolean;
  withClickPropagation?: boolean;
  onClick?: (e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onContextMenu?: (e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onMouseDown?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  onMouseEnter?: NoneToVoidFunction;
  onMouseLeave?: NoneToVoidFunction;
  onFocus?: NoneToVoidFunction;
};

// Longest animation duration;
const CLICKED_TIMEOUT = 400;

const Button: FC<OwnProps> = ({
  ref,
  type = 'button',
  onClick,
  onContextMenu,
  onMouseDown,
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
  ariaLabel,
  href,
  download,
  disabled,
  ripple,
  faded,
  tabIndex,
  isRtl,
  withClickPropagation,
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
    isText && 'text',
    isLoading && 'loading',
    ripple && 'has-ripple',
    faded && 'faded',
    isClicked && 'clicked',
    backgroundImage && 'with-image',
  );

  const handleClick = useCallback((e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => {
    if (!disabled && onClick) {
      onClick(e);
    }

    setIsClicked(true);
    setTimeout(() => {
      setIsClicked(false);
    }, CLICKED_TIMEOUT);
  }, [disabled, onClick]);

  const handleMouseDown = useCallback((e: ReactMouseEvent<HTMLButtonElement>) => {
    if (!withClickPropagation) e.preventDefault();
    if (!disabled && onMouseDown) {
      onMouseDown(e);
    }
  }, [onMouseDown, disabled, withClickPropagation]);

  if (href) {
    return (
      <a
        ref={elementRef as RefObject<HTMLAnchorElement>}
        className={fullClassName}
        href={href}
        title={ariaLabel}
        download={download}
        tabIndex={tabIndex}
        dir={isRtl ? 'rtl' : undefined}
      >
        {children}
        {!disabled && ripple && (
          <RippleEffect />
        )}
      </a>
    );
  }

  return (
    // eslint-disable-next-line react/button-has-type
    <button
      ref={elementRef as RefObject<HTMLButtonElement>}
      type={type}
      className={fullClassName}
      onClick={handleClick}
      onContextMenu={onContextMenu}
      onMouseDown={handleMouseDown}
      onMouseEnter={onMouseEnter && !disabled ? onMouseEnter : undefined}
      onMouseLeave={onMouseLeave && !disabled ? onMouseLeave : undefined}
      onFocus={onFocus && !disabled ? onFocus : undefined}
      aria-label={ariaLabel}
      title={ariaLabel}
      tabIndex={tabIndex}
      dir={isRtl ? 'rtl' : undefined}
      // @ts-ignore
      style={backgroundImage ? `background-image: url(${backgroundImage})` : undefined}
    >
      {isLoading ? (
        <div>
          <span dir={isRtl ? 'auto' : undefined}>Please wait...</span>
          <Spinner color={isText ? 'blue' : 'white'} />
        </div>
      ) : children }
      {!disabled && ripple && (
        <RippleEffect />
      )}
    </button>
  );
};

export default Button;
