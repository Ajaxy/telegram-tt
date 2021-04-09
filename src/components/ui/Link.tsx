import React, { FC, useCallback } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import './Link.scss';

type OwnProps = {
  children: any;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

const Link: FC<OwnProps> = ({ children, className, onClick }) => {
  const handleClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onClick!(e);
  }, [onClick]);

  return (
    <a
      href="#"
      className={buildClassName('Link', className)}
      onClick={onClick ? handleClick : undefined}
    >
      {children}
    </a>
  );
};

export default Link;
