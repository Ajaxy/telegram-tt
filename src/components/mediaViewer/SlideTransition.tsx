import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import { IS_TOUCH_ENV } from '../../util/environment';

import type { ChildrenFn, TransitionProps } from '../ui/Transition';
import Transition from '../ui/Transition';

const SlideTransition: FC<TransitionProps & { children: ChildrenFn }> = ({ children, ...props }) => {
  if (IS_TOUCH_ENV) return children(true, true, 1);
  // eslint-disable-next-line react/jsx-props-no-spreading
  return <Transition {...props}>{children}</Transition>;
};

export default SlideTransition;
