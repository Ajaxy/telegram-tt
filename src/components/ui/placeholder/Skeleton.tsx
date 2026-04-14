import type { FC } from '@teact';
import { memo } from '@teact';

import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';

import './Skeleton.scss';

type OwnProps = {
  variant?: 'rectangular' | 'rounded-rect' | 'round';
  animation?: 'wave' | 'fast-wave' | 'pulse' | 'none';
  width?: number;
  height?: number;
  forceAspectRatio?: boolean;
  inline?: boolean;
  className?: string;
  style?: string;
};

const Skeleton: FC<OwnProps> = ({
  variant = 'rectangular',
  animation = 'none',
  width,
  height,
  forceAspectRatio,
  inline,
  className,
  style,
}) => {
  const classNames = buildClassName('Skeleton', variant, animation, className, inline && 'inline');
  const aspectRatio = (width && height) ? `aspect-ratio: ${width}/${height}` : undefined;
  const computedStyle = buildStyle(
    style,
    forceAspectRatio && aspectRatio,
    Boolean(width) && `width: ${width}px`,
    !forceAspectRatio && Boolean(height) && `height: ${height}px`,
  );
  return (
    <div className={classNames} style={computedStyle}>{inline && '\u00A0'}</div>
  );
};

export default memo(Skeleton);
