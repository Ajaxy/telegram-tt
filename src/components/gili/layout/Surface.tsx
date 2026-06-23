import type { ElementRef } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import styles from './Surface.module.scss';

type OwnProps = React.HTMLAttributes<HTMLDivElement> & {
  ref?: ElementRef<HTMLDivElement>;
  scrollable?: boolean;
  noPadding?: boolean;
  children: React.ReactNode;
};

type BreakoutProps = React.HTMLAttributes<HTMLDivElement> & {
  ref?: ElementRef<HTMLDivElement>;
  children: React.ReactNode;
};

const Surface = ({
  ref,
  scrollable,
  noPadding,
  className,
  children,
  ...otherProps
}: OwnProps) => {
  const isScrollable = Boolean(scrollable);

  return (
    <div
      ref={ref}
      className={buildClassName(
        styles.root,
        isScrollable && 'custom-scroll',
        isScrollable && styles.scrollable,
        noPadding && styles.noPadding,
        className,
      )}
      {...otherProps}
    >
      {children}
    </div>
  );
};

export const Breakout = ({
  ref,
  className,
  children,
  ...otherProps
}: BreakoutProps) => {
  return (
    <div
      ref={ref}
      className={buildClassName(styles.breakout, className)}
      {...otherProps}
    >
      {children}
    </div>
  );
};

export default Surface;
