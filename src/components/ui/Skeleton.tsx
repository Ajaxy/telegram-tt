import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';

import './Skeleton.scss';

type OwnProps = {
  variant?: 'rectangular' | 'rounded-rect' | 'round';
  animation?: 'wave' | 'pulse';
  width?: number;
  height?: number;
  forceAspectRatio?: boolean;
  className?: string;
};

const Skeleton: FC<OwnProps> = ({
  variant = 'rectangular',
  animation = 'wave',
  width,
  height,
  forceAspectRatio,
  className,
}) => {
  const classNames = buildClassName('Skeleton', variant, animation, className);
  const aspectRatio = (width && height) ? `aspect-ratio: ${width}/${height}` : undefined;
  const style = forceAspectRatio ? aspectRatio
    : buildStyle(Boolean(width) && `width: ${width}px`, Boolean(height) && `height: ${height}px`);
  return (
    <div className={classNames} style={style} />
  );
};

export default Skeleton;
