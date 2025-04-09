import React, { memo, type TeactNode } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './MiniTable.module.scss';

export type TableEntry = [TeactNode, TeactNode];

type OwnProps = {
  data: TableEntry[];
  className?: string;
  style?: string;
  valueClassName?: string;
  keyClassName?: string;
};

const MiniTable = ({
  data,
  style,
  className,
  valueClassName,
  keyClassName,
}: OwnProps) => {
  return (
    <div className={buildClassName(styles.root, className)} style={style}>
      {data.map(([key, value]) => (
        <>
          <div className={buildClassName(styles.key, keyClassName)}>{key}</div>
          <div className={buildClassName(styles.value, valueClassName)}>{value}</div>
        </>
      ))}
    </div>
  );
};

export default memo(MiniTable);
