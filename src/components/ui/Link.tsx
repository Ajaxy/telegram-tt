import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import useLastCallback from '../../hooks/useLastCallback';

import styles from './Link.module.scss';

type OwnProps = {
  children: React.ReactNode;
  className?: string;
  isRtl?: boolean;
  isPrimary?: boolean;
  withMultilineFix?: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

const Link: FC<OwnProps> = ({
  children, isPrimary, className, isRtl, withMultilineFix, onClick,
}) => {
  const handleClick = useLastCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onClick!(e);
  });

  return (
    <a
      href="#"
      className={buildClassName('Link', styles.link, className, isPrimary && styles.isPrimary)}
      dir={!withMultilineFix ? (isRtl ? 'rtl' : 'auto') : undefined}
      onClick={onClick ? handleClick : undefined}
    >
      {children}
    </a>
  );
};

export default Link;
