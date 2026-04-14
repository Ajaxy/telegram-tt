import { memo, useMemo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import Skeleton from './Skeleton';

import styles from './TextLoadingPlaceholder.module.scss';

type OwnProps = {
  lines?: number;
  className?: string;
};

const WIDTH_PATTERNS = [
  [85, 90, 87, 83, 87, 70],
  [81, 75, 83, 87, 81, 93],
  [73, 87, 91, 75, 87, 91],
];

const TextLoadingPlaceholder = ({
  lines = 6,
  className,
}: OwnProps) => {
  const lineWidths = useMemo(() => {
    const patternIndex = Math.floor(Math.random() * WIDTH_PATTERNS.length);
    const pattern = WIDTH_PATTERNS[patternIndex];
    return Array.from({ length: lines }, (_, i) => pattern[i % pattern.length]);
  }, [lines]);

  return (
    <div className={buildClassName(styles.root, className)}>
      {lineWidths.map((width, i) => (
        <Skeleton
          key={i}
          variant="rounded-rect"
          animation="fast-wave"
          className={styles.line}
          style={`width: ${width}%`}
        />
      ))}
    </div>
  );
};

export default memo(TextLoadingPlaceholder);
