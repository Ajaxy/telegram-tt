import React, { FC } from '../../lib/teact/teact';
import { IS_TOUCH_ENV } from '../../util/environment';
import Transition, { TransitionProps } from '../ui/Transition';

const SlideTransition: FC<TransitionProps> = ({ children, ...props }) => {
  if (IS_TOUCH_ENV) {
    // Return dummy container to keep existing DOM structure, needed to preserve ghost animation
    return (
      <div className="Transition">
        <div className="Transition__slide--active">
          {children(true, true, 1)}
        </div>
      </div>
    );
  }
  // eslint-disable-next-line react/jsx-props-no-spreading
  return <Transition {...props}>{children}</Transition>;
};

export default SlideTransition;
