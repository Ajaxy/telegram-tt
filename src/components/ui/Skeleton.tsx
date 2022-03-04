import React, { FC } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import './Skeleton.scss';

type OwnProps = {
  variant?: 'rectangular' | 'rounded-rect' | 'round';
  animation?: 'wave' | 'pulse';
  width?: number;
  height?: number;
  className?: string;
};

const Skeleton: FC<OwnProps> = ({ variant = 'rectangular', animation = 'wave', width, height, className }) => {
  const classNames = buildClassName('Skeleton', variant, animation, className);
  const style = (width ? `width: ${width}px;` : '') + (height ? `height: ${height}px;` : '');
  return (
    <div className={classNames} style={style} />
  );
};

export default Skeleton;
