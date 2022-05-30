import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import Spinner from './Spinner';
import buildClassName from '../../util/buildClassName';

import './Loading.scss';

type OwnProps = {
  color?: 'blue' | 'white' | 'black' | 'yellow';
  backgroundColor?: 'light' | 'dark';
  onClick?: NoneToVoidFunction;
};

const Loading: FC<OwnProps> = ({ color = 'blue', backgroundColor, onClick }) => {
  return (
    <div className={buildClassName('Loading', onClick && 'interactive')} onClick={onClick}>
      <Spinner color={color} backgroundColor={backgroundColor} />
    </div>
  );
};

export default memo(Loading);
