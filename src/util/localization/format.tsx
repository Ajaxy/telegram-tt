import type { ApiTypeCurrencyAmount } from '../../api/types';
import type { LangFn } from './types';

import { STARS_ICON_PLACEHOLDER, TON_CURRENCY_CODE } from '../../config';
import { convertTonFromNanos } from '../../util/formatCurrency';
import buildClassName from '../buildClassName';

import Icon from '../../components/common/icons/Icon';
import StarIcon from '../../components/common/icons/StarIcon';

export const NEXT_ARROW_REPLACEMENT = {
  '>': <Icon name="next-link" className="link-arrow-icon" />,
};
export const PREVIOUS_ARROW_REPLACEMENT = {
  '<': <Icon name="previous-link" className="link-arrow-icon" />,
};

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
    className?: string;
    containerClassName?: string;
    withWrapper?: boolean;
    shouldConvertFromNanos?: boolean;
  }) {
  const { className, containerClassName, withWrapper, shouldConvertFromNanos } = options || {};
  const formattedAmount = shouldConvertFromNanos ? convertTonFromNanos(Number(amount)) : amount;
  const icon = <Icon name="toncoin" className={buildClassName('in-text-icon', className)} />;

  if (containerClassName || withWrapper) {
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
  asFont?: boolean;
  className?: string;
  containerClassName?: string;
  withWrapper?: boolean;
}) {
  const { asFont, className, containerClassName, withWrapper } = options || {};
  const icon = asFont
    ? <Icon name="star" className={buildClassName('in-text-icon', className)} />
    : <StarIcon type="gold" className={className} size="adaptive" />;

  if (containerClassName || withWrapper) {
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
