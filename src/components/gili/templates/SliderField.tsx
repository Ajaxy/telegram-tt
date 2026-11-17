import type { TeactNode } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import styles from './SliderField.module.scss';

type OwnProps = {
  label: TeactNode;
  value: TeactNode;
  isValueAccented?: boolean;
  className?: string;
  style?: string;
  children: TeactNode;
};

const SliderField = ({
  label,
  value,
  isValueAccented,
  className,
  style,
  children,
}: OwnProps) => {
  return (
    <div className={buildClassName(styles.root, className)} style={style}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={buildClassName(styles.value, isValueAccented && styles.accented)}>{value}</span>
      </div>
      {children}
    </div>
  );
};

export default SliderField;
