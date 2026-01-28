import { memo } from '@teact';

import styles from './EntityStatusChip.module.scss';

interface Props {
  label: string;
  color: string;
}

const EntityStatusChip = ({ label, color }: Props) => {
  return (
    <div className={`${styles.itemStatusChip} ${styles[color]}`}>
      <p className={styles.itemStatusChipLabel}>{label}</p>
    </div>
  );
};

export default memo(EntityStatusChip);
