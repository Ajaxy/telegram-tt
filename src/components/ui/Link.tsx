import type { FC } from '../../lib/teact/teact';
import React, { useCallback } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './Link.module.scss';

type OwnProps = {
  children: React.ReactNode;
  className?: string;
  isRtl?: boolean;
  isPrimary?: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

const Link: FC<OwnProps> = ({
  children, isPrimary, className, isRtl, onClick,
}) => {
  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onClick!(e);
  }, [onClick]);

  return (
    <a
      href="#"
      className={buildClassName(styles.link, className, isPrimary && styles.isPrimary)}
      dir={isRtl ? 'rtl' : 'auto'}
      onClick={onClick ? handleClick : undefined}
    >
      {children}
    </a>
  );
};

export default Link;
