import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import Spinner from './Spinner';

import './Loading.scss';

type OwnProps = {
  color?: 'blue' | 'white' | 'black' | 'yellow';
  backgroundColor?: 'light' | 'dark';
  className?: string;
  onClick?: NoneToVoidFunction;
};

const Loading = ({
  color = 'blue', backgroundColor, className, onClick,
}: OwnProps) => {
  return (
    <div className={buildClassName('Loading', onClick && 'interactive', className)} onClick={onClick}>
      <Spinner color={color} backgroundColor={backgroundColor} />
    </div>
  );
};

export default memo(Loading);
