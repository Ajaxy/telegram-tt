import React, { memo } from '../../../lib/teact/teact';

import type { ApiStarsAmount } from '../../../api/types';

import { formatStarsAmount } from '../../../global/helpers/payments';
import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';

import StarIcon from '../../common/icons/StarIcon';

import styles from './StarsBalanceModal.module.scss';

type OwnProps = {
  balance?: ApiStarsAmount;
  className?: string;
};

const BalanceBlock = ({ balance, className }: OwnProps) => {
  const lang = useLang();

  return (
    <div className={buildClassName(styles.balance, className)}>
      <span className={styles.smallerText}>{lang('StarsBalance')}</span>
      <div className={styles.balanceBottom}>
        <StarIcon type="gold" size="middle" />
        {balance !== undefined ? formatStarsAmount(lang, balance) : '…'}
      </div>
    </div>
  );
};

export default memo(BalanceBlock);
