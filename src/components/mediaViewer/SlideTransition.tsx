import React, { FC } from '../../lib/teact/teact';

import { IS_TOUCH_ENV } from '../../util/environment';

import Transition, { TransitionProps } from '../ui/Transition';

const SlideTransition: FC<TransitionProps> = ({ children, ...props }) => {
  if (IS_TOUCH_ENV) return children(true, true, 1);
  // eslint-disable-next-line react/jsx-props-no-spreading
  return <Transition {...props}>{children}</Transition>;
};

export default SlideTransition;
