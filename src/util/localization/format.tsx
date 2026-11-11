import type { ApiTypeCurrencyAmount } from '../../api/types';
import type { LangFn } from './types';

import { STARS_ICON_PLACEHOLDER, TON_CURRENCY_CODE } from '../../config';
import { convertTonFromNanos, formatTonFromNanos, formatTonShortFromNanos } from '../../util/formatCurrency';
import buildClassName from '../buildClassName';

import GramIcon from '../../components/common/icons/GramIcon';
import Icon from '../../components/common/icons/Icon';
import StarIcon from '../../components/common/icons/StarIcon';

const DECIMAL_SAMPLE = 0.5;

export const NEXT_ARROW_REPLACEMENT = {
  '>': <Icon name="next-link" className="link-arrow-icon" />,
};
export const PREVIOUS_ARROW_REPLACEMENT = {
  '<': <Icon name="previous-link" className="link-arrow-icon" />,
};

export function formatStarsAsText(lang: LangFn, amount: number) {
  return lang('StarsAmountText', { amount }, { pluralValue: amount });
}

export function formatTonAsText(lang: LangFn, nanos: bigint) {
  const amount = convertTonFromNanos(nanos);
  return lang('GramAmountText', { amount: lang.preciseNumber(amount) }, { pluralValue: amount });
}

export function formatTonTextFromNanos(lang: LangFn, nanos: bigint, isShort?: boolean) {
  return lang('GramAmountText', { amount: formatTonNumber(lang, nanos, isShort) }, {
    pluralValue: convertTonFromNanos(nanos),
  });
}

export function formatTonNumber(lang: LangFn, nanos: bigint, isShort?: boolean) {
  return formatTonParts(lang, nanos, isShort).join('');
}

// The whole part is grouped as a `bigint`, so the full amount keeps every nanoton a float would round off
export function formatTonParts(lang: LangFn, nanos: bigint, isShort?: boolean): [whole: string, fraction?: string] {
  const formatter = lang.internalFormatters.preciseNumber;
  const [whole, fraction] = (isShort ? formatTonShortFromNanos(nanos) : formatTonFromNanos(nanos)).split('.');
  const formattedWhole = formatter.format(BigInt(whole));
  if (!fraction) return [formattedWhole];

  const decimal = formatter.formatToParts(DECIMAL_SAMPLE).find(({ type }) => type === 'decimal')!.value;
  // Digit by digit, so the leading zeros stay and the digits follow the locale, such as Persian
  const formattedFraction = fraction.replace(/\d/g, (digit) => formatter.format(Number(digit)));

  return [formattedWhole, `${decimal}${formattedFraction}`];
}

export function formatTonAsIcon(
  lang: LangFn,
  // Nanotons, or an amount already formatted for display
  amount: bigint | string,
  options?: {
    className?: string;
    containerClassName?: string;
    withWrapper?: boolean;
    isMono?: boolean;
    withIconLast?: boolean;
  }) {
  const {
    className, containerClassName, withWrapper, isMono, withIconLast,
  } = options || {};
  const formattedAmount = typeof amount === 'bigint' ? convertTonFromNanos(amount) : amount;
  const icon = (
    <GramIcon
      isMono={isMono}
      className={buildClassName('in-text-icon', withIconLast && 'in-text-icon-last', className)}
    />
  );
  const key = withIconLast ? 'GramAmountIconLast' : 'GramAmount';

  if (containerClassName || withWrapper) {
    return (
      <span className={containerClassName}>
        {lang(key, { amount: formattedAmount }, {
          withNodes: true,
          specialReplacement: {
            '💎': icon,
          },
        })}
      </span>
    );
  }

  return lang(key, { amount: formattedAmount }, {
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
  withIconLast?: boolean;
}) {
  const { asFont, className, containerClassName, withWrapper, withIconLast } = options || {};
  const iconClassName = buildClassName(withIconLast && 'in-text-icon-last', className);
  const icon = asFont
    ? <Icon name="star" className={buildClassName('in-text-icon', iconClassName)} />
    : <StarIcon type="gold" className={iconClassName} size="adaptive" />;
  const key = withIconLast ? 'StarsAmountIconLast' : 'StarsAmount';

  if (containerClassName || withWrapper) {
    return (
      <span className={containerClassName}>
        {lang(key, { amount }, {
          withNodes: true,
          specialReplacement: {
            [STARS_ICON_PLACEHOLDER]: icon,
          },
        })}
      </span>
    );
  }

  return lang(key, { amount }, {
    withNodes: true,
    specialReplacement: {
      [STARS_ICON_PLACEHOLDER]: icon,
    },
  });
}

export function formatCurrencyAmountAsText(lang: LangFn, currencyAmount: ApiTypeCurrencyAmount) {
  if (currencyAmount.currency === TON_CURRENCY_CODE) {
    return formatTonAsText(lang, currencyAmount.amount);
  }

  const amount = currencyAmount.amount + currencyAmount.nanos / 1e9;
  return formatStarsAsText(lang, amount);
}
