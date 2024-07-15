import React, { type TeactNode } from '../lib/teact/teact';

import type { LangCode } from '../types';

import { STARS_CURRENCY_CODE } from '../config';

import StarIcon from '../components/common/icons/StarIcon';

export function formatCurrency(
  totalPrice: number,
  currency: string,
  locale: LangCode = 'en',
  options?: {
    shouldOmitFractions?: boolean;
    iconClassName?: string;
  },
): TeactNode {
  const price = totalPrice / 10 ** getCurrencyExp(currency);

  if (currency === STARS_CURRENCY_CODE) {
    return [<StarIcon className={options?.iconClassName} type="gold" size="adaptive" />, price];
  }

  return formatCurrencyAsString(totalPrice, currency, locale, options);
}

export function formatCurrencyAsString(
  totalPrice: number,
  currency: string,
  locale: LangCode = 'en',
  options?: {
    shouldOmitFractions?: boolean;
  },
) {
  const price = totalPrice / 10 ** getCurrencyExp(currency);

  if (options?.shouldOmitFractions && price % 1 === 0) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(price);
}

function getCurrencyExp(currency: string) {
  if (currency === 'TON') {
    return 9;
  }
  if (currency === 'CLF') {
    return 4;
  }
  if (['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'].includes(currency)) {
    return 3;
  }
  if ([
    'BIF', 'BYR', 'CLP', 'CVE', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'UYI',
    'VND', 'VUV', 'XAF', 'XOF', 'XPF', STARS_CURRENCY_CODE,
  ].includes(currency)) {
    return 0;
  }
  if (currency === 'MRO') {
    return 1;
  }
  return 2;
}
