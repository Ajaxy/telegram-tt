import React, { FC } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import './Spinner.scss';

const Spinner: FC<{
  color?: 'blue' | 'white' | 'black' | 'green' | 'gray';
  withBackground?: boolean;
}> = ({
  color = 'blue',
  withBackground,
}) => {
  return (
    <div className={buildClassName('Spinner', color, withBackground && 'with-background')}>
      <div />
    </div>
  );
};

export default Spinner;
