import type { ApiTypeCurrencyAmount } from '../../api/types';
import type { LangFn } from './types';

import { STARS_ICON_PLACEHOLDER, TON_CURRENCY_CODE } from '../../config';
import { convertTonFromNanos } from '../../util/formatCurrency';
import buildClassName from '../buildClassName';

import Icon from '../../components/common/icons/Icon';
import StarIcon from '../../components/common/icons/StarIcon';

export function formatStarsAsText(lang: LangFn, amount: number) {
  return lang('StarsAmountText', { amount }, { pluralValue: amount });
}

export function formatTonAsText(lang: LangFn, amount: number, shouldConvertFromNanos?: boolean) {
  const formattedAmount = shouldConvertFromNanos ? convertTonFromNanos(Number(amount)) : amount;
  return lang('TonAmountText', { amount: lang.preciseNumber(formattedAmount) }, { pluralValue: formattedAmount });
}

export function formatTonAsIcon(
  lang: LangFn,
  amount: number | string,
  options?: {
    className?: string; containerClassName?: string; shouldConvertFromNanos?: boolean;
  }) {
  const { className, containerClassName, shouldConvertFromNanos } = options || {};
  const formattedAmount = shouldConvertFromNanos ? convertTonFromNanos(Number(amount)) : amount;
  const icon = <Icon name="toncoin" className={buildClassName('ton-amount-icon', className)} />;

  if (containerClassName) {
    return (
      <span className={containerClassName}>
        {lang('TonAmount', { amount: formattedAmount }, {
          withNodes: true,
          specialReplacement: {
            '💎': icon,
          },
        })}
      </span>
    );
  }

  return lang('TonAmount', { amount: formattedAmount }, {
    withNodes: true,
    specialReplacement: {
      '💎': icon,
    },
  });
}

export function formatStarsAsIcon(lang: LangFn, amount: number | string, options?: {
  asFont?: boolean; className?: string; containerClassName?: string; }) {
  const { asFont, className, containerClassName } = options || {};
  const icon = asFont
    ? <Icon name="star" className={buildClassName('star-amount-icon', className)} />
    : <StarIcon type="gold" className={buildClassName('star-amount-icon', className)} size="adaptive" />;

  if (containerClassName) {
    return (
      <span className={containerClassName}>
        {lang('StarsAmount', { amount }, {
          withNodes: true,
          specialReplacement: {
            [STARS_ICON_PLACEHOLDER]: icon,
          },
        })}
      </span>
    );
  }

  return lang('StarsAmount', { amount }, {
    withNodes: true,
    specialReplacement: {
      [STARS_ICON_PLACEHOLDER]: icon,
    },
  });
}

export function formatCurrencyAmountAsText(lang: LangFn, currencyAmount: ApiTypeCurrencyAmount) {
  if (currencyAmount.currency === TON_CURRENCY_CODE) {
    return formatTonAsText(lang, currencyAmount.amount, true);
  }

  const amount = currencyAmount.amount + currencyAmount.nanos / 1e9;
  return formatStarsAsText(lang, amount);
}
