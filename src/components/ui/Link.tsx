import type { FC } from '../../lib/teact/teact';
import React, { useCallback } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import './Link.scss';

type OwnProps = {
  children: React.ReactNode;
  className?: string;
  isRtl?: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

const Link: FC<OwnProps> = ({
  children, className, isRtl, onClick,
}) => {
  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onClick!(e);
  }, [onClick]);

  return (
    <a
      href="#"
      className={buildClassName('Link', className)}
      dir={isRtl ? 'rtl' : 'auto'}
      onClick={onClick ? handleClick : undefined}
    >
      {children}
    </a>
  );
};

export default Link;
