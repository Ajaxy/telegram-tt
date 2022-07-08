import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../../lib/teact/teact';

import { lerp } from '../../../../util/math';

import PremiumLimitsCompare from './PremiumLimitsCompare';

import styles from './PremiumLimitPreview.module.scss';

type OwnProps = {
  title: string;
  description: string;
  leftValue?: string;
  rightValue?: string;
  colorStepProgress: number;
};

const COLOR_START = [91, 160, 255];
const COLOR_END = [197, 100, 243];

const PremiumLimitPreview: FC<OwnProps> = ({
  title,
  description,
  leftValue,
  rightValue,
  colorStepProgress,
}) => {
  const color = useMemo(() => {
    return COLOR_START.map((start, i) => lerp(start, COLOR_END[i], colorStepProgress));
  }, [colorStepProgress]);

  return (
    <div className={styles.root}>
      <div className={styles.title}>{title}</div>
      <div className={styles.description}>{description}</div>
      <PremiumLimitsCompare
        leftValue={leftValue}
        rightValue={rightValue}
        rightStyle={`background: rgb(${color.join(',')})`}
      />
    </div>
  );
};

export default memo(PremiumLimitPreview);
