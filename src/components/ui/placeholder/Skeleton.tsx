import type { FC } from '@teact';
import { memo } from '@teact';

import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';

import './Skeleton.scss';

type OwnProps = {
  variant?: 'rectangular' | 'rounded-rect' | 'round';
  animation?: 'wave' | 'pulse';
  width?: number;
  height?: number;
  forceAspectRatio?: boolean;
  inline?: boolean;
  className?: string;
};

const Skeleton: FC<OwnProps> = ({
  variant = 'rectangular',
  animation = 'wave',
  width,
  height,
  forceAspectRatio,
  inline,
  className,
}) => {
  const classNames = buildClassName('Skeleton', variant, animation, className, inline && 'inline');
  const aspectRatio = (width && height) ? `aspect-ratio: ${width}/${height}` : undefined;
  const style = buildStyle(
    forceAspectRatio && aspectRatio,
    Boolean(width) && `width: ${width}px`,
    !forceAspectRatio && Boolean(height) && `height: ${height}px`,
  );
  return (
    <div className={classNames} style={style}>{inline && '\u00A0'}</div>
  );
};

export default memo(Skeleton);
