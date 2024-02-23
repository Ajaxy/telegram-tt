import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './MenuSeparator.module.scss';

type OwnProps = {
  className?: string;
  size?: 'thin' | 'thick';
};

const MenuSeparator: FC<OwnProps> = ({ className, size = 'thin' }) => {
  return (
    <div className={buildClassName(styles.root, styles[size], className)} />
  );
};

export default MenuSeparator;
