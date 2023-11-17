import React from 'react';
import type { FC } from '../../lib/teact/teact';

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
      'Spinner', className, color, backgroundColor && 'with-background', backgroundColor && `bg-${backgroundColor}`,
    )}
    >
      <div className="Spinner__inner" />
    </div>
  );
};

export default Spinner;
