import React, { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';
import { formatInteger } from '../../../util/textFormat';

import useOldLang from '../../../hooks/useOldLang';

import StarIcon from '../../common/icons/StarIcon';

import styles from './StarsBalanceModal.module.scss';

type OwnProps = {
  balance: number;
  className?: string;
};

const BalanceBlock = ({ balance, className }: OwnProps) => {
  const lang = useOldLang();

  return (
    <div className={buildClassName(styles.balance, className)}>
      <span className={styles.smallerText}>{lang('StarsBalance')}</span>
      <div className={styles.balanceBottom}>
        <StarIcon type="gold" size="middle" />
        {formatInteger(balance)}
      </div>
    </div>
  );
};

export default memo(BalanceBlock);
