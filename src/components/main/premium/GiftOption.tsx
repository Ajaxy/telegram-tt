import type { ChangeEvent } from 'react';
import React, { memo, useCallback, useMemo } from '../../../lib/teact/teact';

import type { FC } from '../../../lib/teact/teact';
import type { ApiPremiumGiftOption } from '../../../api/types';

import { formatCurrency } from '../../../util/formatCurrency';
import buildClassName from '../../../util/buildClassName';
import useLang from '../../../hooks/useLang';

import styles from './GiftOption.module.scss';

type OwnProps = {
  option: ApiPremiumGiftOption;
  checked?: boolean;
  fullMonthlyAmount?: number;
  onChange: (month: number) => void;
};

const GiftOption: FC<OwnProps> = ({
  option, checked, fullMonthlyAmount, onChange,
}) => {
  const lang = useLang();

  const { months, amount, currency } = option;
  const perMonth = Math.floor(amount / months);

  const discount = useMemo(() => {
    return fullMonthlyAmount && fullMonthlyAmount > perMonth
      ? Math.ceil(100 - perMonth / (fullMonthlyAmount / 100))
      : undefined;
  }, [fullMonthlyAmount, perMonth]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      onChange(months);
    }
  }, [months, onChange]);

  return (
    <label className={buildClassName(styles.wrapper, checked && styles.active)} dir={lang.isRtl ? 'rtl' : undefined}>
      <input
        className={styles.input}
        type="radio"
        name="gift_option"
        value={months}
        checked={checked}
        onChange={handleChange}
      />
      <div className={styles.content}>
        <div className={styles.month}>{lang('Months', months)}</div>
        <div className={styles.perMonth}>
          {lang('PricePerMonth', formatCurrency(perMonth, currency, lang.code))}
          {discount && (
            <span className={styles.discount} title={lang('GiftDiscount')}> &minus;{discount}% </span>
          )}
        </div>
        <div className={styles.amount}>{formatCurrency(amount, currency, lang.code)}</div>
      </div>
    </label>
  );
};

export default memo(GiftOption);
