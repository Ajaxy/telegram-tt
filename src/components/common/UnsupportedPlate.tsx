import { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import Icon from './icons/Icon';

import styles from './UnsupportedPlate.module.scss';

type OwnProps = {
  title: string;
  text: string;
  className?: string;
};

const UnsupportedPlate = ({ title, text, className }: OwnProps) => {
  return (
    <div className={buildClassName(styles.root, className)}>
      <div className={styles.badge}>
        <Icon name="new-send" className={styles.icon} />
      </div>
      <div className={styles.text}>
        <div className={styles.title}>{title}</div>
        <div className={styles.subtitle}>{text}</div>
      </div>
    </div>
  );
};

export default memo(UnsupportedPlate);
