import type { FC } from '../../lib/teact/teact';
import React, { useRef, useCallback, memo } from '../../lib/teact/teact';

import { IS_TOUCH_ENV } from '../../util/environment';

import type { OwnProps as ButtonProps } from './Button';
import Button from './Button';

type OwnProps = {
  onActivate: NoneToVoidFunction;
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

  const handleMouseEnter = useCallback(() => {
    isMouseInside.current = true;

    // This is used to counter additional delay caused by asynchronous module loading
    if (isFirstTimeActivation) {
      isFirstTimeActivation = false;
      onActivate();
      return;
    }

    if (openTimeout) {
      clearTimeout(openTimeout);
      openTimeout = undefined;
    }
    openTimeout = window.setTimeout(() => {
      if (isMouseInside.current) {
        onActivate();
      }
    }, BUTTON_ACTIVATE_DELAY);
  }, [onActivate]);

  const handleMouseLeave = useCallback(() => {
    isMouseInside.current = false;
  }, []);

  const handleClick = useCallback(() => {
    isMouseInside.current = true;
    onActivate();
  }, [onActivate]);

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

export default memo(ResponsiveHoverButton);
