import { memo } from '../../../../lib/teact/teact';

import buildClassName from '../../../../util/buildClassName';
import { clamp } from '../../../../util/math';
import { REM } from '../../../common/helpers/mediaDimensions';

import styles from './RadialProgress.module.scss';

type OwnProps = {
  progress: number;
  size?: number;
  className?: string;
};

const VIEWBOX_SIZE = 100;
const RADIUS_RATIO = 0.35; // 35% of viewbox size
const STROKE_START = 0.125;
const STROKE_END = 0.875;
const ARC_RANGE = STROKE_END - STROKE_START; // 0.75 = 270 degrees

export const DEFAULT_RING_SIZE = 7.5 * REM;

const RadialProgress = ({ progress, size = DEFAULT_RING_SIZE, className }: OwnProps) => {
  const center = VIEWBOX_SIZE / 2;
  const radius = VIEWBOX_SIZE * RADIUS_RATIO;

  const clampedProgress = clamp(progress, 0, 100);
  const progressStrokeEnd = STROKE_START + ARC_RANGE * (clampedProgress / 100);

  const bgDashoffset = 1 - ARC_RANGE;
  const fillDashoffset = 1 - (progressStrokeEnd - STROKE_START);

  return (
    <svg
      className={buildClassName(styles.root, className)}
      viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
      style={`width: ${size}px; height: ${size}px`}
    >
      <circle
        className={styles.background}
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        pathLength="1"
        style={`stroke-dasharray: 1; stroke-dashoffset: ${bgDashoffset}`}
      />
      <circle
        className={styles.fill}
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        pathLength="1"
        style={`stroke-dasharray: 1; stroke-dashoffset: ${fillDashoffset}`}
      />
    </svg>
  );
};

export default memo(RadialProgress);
