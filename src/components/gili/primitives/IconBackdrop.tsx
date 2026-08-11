import { memo } from '../../../lib/teact/teact';

import type { IconName } from '../../../types/icons';

import buildClassName from '../../../util/buildClassName';

import Icon from '../../common/icons/Icon';

import styles from './IconBackdrop.module.scss';

export type IconBackdropColor = 'blue' | 'gray' | 'green' | 'orange' | 'pink' | 'premium' | 'purple' | 'red';

type OwnProps = {
  color: IconBackdropColor;
  icon: IconName;
  className?: string;
};

const IconBackdrop = ({ color, icon, className }: OwnProps) => {
  return (
    <div className={buildClassName(styles.root, styles[color], className)}>
      <Icon name={icon} className={styles.icon} />
    </div>
  );
};

export default memo(IconBackdrop);
