import type { ElementRef, TeactNode } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import styles from './MediaBadge.module.scss';

type OwnProps = {
  ref?: ElementRef<HTMLDivElement>;
  children: TeactNode;
  className?: string;
  position?: 'left' | 'right';
};

const MediaBadge = ({
  ref,
  children,
  className,
  position = 'left',
}: OwnProps) => {
  const fullClassName = buildClassName(styles.badge, position === 'right' && styles.right, className);

  return (
    <div ref={ref} className={fullClassName}>
      {children}
    </div>
  );
};

export default MediaBadge;
