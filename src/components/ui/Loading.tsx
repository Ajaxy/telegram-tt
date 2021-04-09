import React, { FC, memo } from '../../lib/teact/teact';

import Spinner from './Spinner';

import './Loading.scss';

type OwnProps = {
  color?: 'blue' | 'white' | 'black';
};

const Loading: FC<OwnProps> = ({ color = 'blue' }) => {
  return (
    <div className="Loading">
      <Spinner color={color} withBackground={color === 'white'} />
    </div>
  );
};

export default memo(Loading);
