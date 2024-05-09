import type { ChangeEvent } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useMemo } from '../../../lib/teact/teact';

import type { ApiPremiumGiftCodeOption, ApiPremiumGiftOption } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { formatCurrency } from '../../../util/formatCurrency';

import useLang from '../../../hooks/useLang';

import styles from './PremiumSubscriptionOption.module.scss';

type OwnProps = {
  option: ApiPremiumGiftOption | ApiPremiumGiftCodeOption;
  isGiveaway?: boolean;
  checked?: boolean;
  fullMonthlyAmount?: number;
  className?: string;
  onChange: (month: number) => void;
};

const PremiumSubscriptionOption: FC<OwnProps> = ({
  option, checked, fullMonthlyAmount,
  onChange, className, isGiveaway,
}) => {
  const lang = useLang();

  const {
    months, amount, currency,
  } = option;
  const users = 'users' in option ? option.users : undefined;
  const perMonth = Math.floor(amount / months);
  const isUserCountPlural = users ? users > 1 : undefined;

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
    <label
      className={buildClassName(
        isGiveaway ? styles.giveawayWrapper : styles.wrapper,
        (checked && !isGiveaway) && styles.active,
        className,
      )}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      <input
        className={styles.input}
        type="radio"
        name="subscription_option"
        value={months}
        checked={checked}
        onChange={handleChange}
      />
      <div className={styles.content}>
        <div className={styles.month}>
          {Boolean(discount) && (
            <span
              className={buildClassName(styles.giveawayDiscount, styles.discount)}
              title={lang('GiftDiscount')}
            > &minus;{discount}%
            </span>
          )}
          {lang('Months', months)}
        </div>
        <div className={styles.perMonth}>
          {(isGiveaway || isUserCountPlural) ? `${formatCurrency(amount, currency, lang.code)} x ${users!}`
            : lang('PricePerMonth', formatCurrency(perMonth, currency, lang.code))}
        </div>
        <div className={styles.amount}>
          {formatCurrency(amount, currency, lang.code)}
        </div>
      </div>
    </label>
  );
};

export default memo(PremiumSubscriptionOption);
