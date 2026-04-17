import buildClassName from '../../../util/buildClassName';

import styles from './Surface.module.scss';

type OwnProps = React.HTMLAttributes<HTMLDivElement> & {
  scrollable?: boolean;
  children: React.ReactNode;
};

const Surface = ({
  scrollable,
  className,
  children,
  ...otherProps
}: OwnProps) => {
  const isScrollable = Boolean(scrollable);

  return (
    <div
      className={buildClassName(
        styles.root,
        isScrollable && 'custom-scroll',
        isScrollable && styles.scrollable,
        className,
      )}
      {...otherProps}
    >
      {children}
    </div>
  );
};

export default Surface;
