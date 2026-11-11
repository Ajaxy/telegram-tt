import { memo } from '../../lib/teact/teact';

import styles from './SelectionOrderBadge.module.scss';

type OwnProps = {
  order: number;
};

const SelectionOrderBadge = ({ order }: OwnProps) => {
  return <div className={styles.root}>{order}</div>;
};

export default memo(SelectionOrderBadge);
