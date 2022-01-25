import React, { FC } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import './Spinner.scss';

const Spinner: FC<{
  color?: 'blue' | 'white' | 'black' | 'green' | 'gray' | 'yellow';
  backgroundColor?: 'light' | 'dark';
}> = ({
  color = 'blue',
  backgroundColor,
}) => {
  return (
    <div className={buildClassName('Spinner', color, backgroundColor && 'with-background', `bg-${backgroundColor}`)}>
      <div />
    </div>
  );
};

export default Spinner;
