import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import './Spinner.scss';

const Spinner: FC<{
  color?: 'blue' | 'white' | 'black' | 'green' | 'gray' | 'yellow';
  backgroundColor?: 'light' | 'dark';
  className?: string;
}> = ({
  color = 'blue',
  backgroundColor,
  className,
}) => {
  return (
    <div className={buildClassName(
      'Spinner', className, color, backgroundColor && 'with-background', `bg-${backgroundColor}`,
    )}
    >
      <div />
    </div>
  );
};

export default Spinner;
