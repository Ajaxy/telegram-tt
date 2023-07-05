import type { FC } from '../../lib/teact/teact';
import React, { useRef } from '../../lib/teact/teact';

import type { OwnProps as ButtonProps } from './Button';

import { IS_TOUCH_ENV } from '../../util/windowEnvironment';

import useLastCallback from '../../hooks/useLastCallback';

import Button from './Button';

type OwnProps = {
  onActivate: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
} & Omit<ButtonProps, (
  'onClick' | 'onMouseDown' |
  'onMouseEnter' | 'onMouseLeave' |
  'onFocus'
)>;

const BUTTON_ACTIVATE_DELAY = 200;
let openTimeout: number | undefined;
let isFirstTimeActivation = true;

const ResponsiveHoverButton: FC<OwnProps> = ({ onActivate, ...buttonProps }) => {
  const isMouseInside = useRef(false);

  const handleMouseEnter = useLastCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    isMouseInside.current = true;

    // This is used to counter additional delay caused by asynchronous module loading
    if (isFirstTimeActivation) {
      isFirstTimeActivation = false;
      onActivate(e);
      return;
    }

    if (openTimeout) {
      clearTimeout(openTimeout);
      openTimeout = undefined;
    }
    openTimeout = window.setTimeout(() => {
      if (isMouseInside.current) {
        onActivate(e);
      }
    }, BUTTON_ACTIVATE_DELAY);
  });

  const handleMouseLeave = useLastCallback(() => {
    isMouseInside.current = false;
  });

  const handleClick = useLastCallback((e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    isMouseInside.current = true;
    onActivate(e);
  });

  return (
    <Button
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...buttonProps}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
      onClick={!IS_TOUCH_ENV ? onActivate : handleClick}
    />
  );
};

export default ResponsiveHoverButton;
