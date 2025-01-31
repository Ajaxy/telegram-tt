import React from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './BadgeButton.module.scss';

type OwnProps = {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

const BadgeButton = ({
  children,
  className,
  onClick,
}: OwnProps) => {
  return (
    <div className={buildClassName(styles.root, onClick && styles.clickable, className)} onClick={onClick}>
      {children}
    </div>
  );
};

export default BadgeButton;
