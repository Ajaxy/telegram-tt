import React from 'react';
import type { FC } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './MenuSeparator.module.scss';

type OwnProps = {
  className?: string;
};

const MenuSeparator: FC<OwnProps> = ({ className }) => {
  return (
    <div className={buildClassName(styles.root, className)} />
  );
};

export default MenuSeparator;
