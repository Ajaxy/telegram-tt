import React from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './BadgeButton.module.scss';

type OwnProps = {
  children: React.ReactNode;
  className?: string;
  onClick?: NoneToVoidFunction;
};

const BadgeButton = ({
  children,
  className,
  onClick,
}: OwnProps) => {
  return (
    <div className={buildClassName(styles.root, className)} onClick={onClick}>
      {children}
    </div>
  );
};

export default BadgeButton;
