import { type TeactNode } from '../lib/teact/teact';

import type { LangFn } from './localization';

import { STARS_CURRENCY_CODE, TON_CURRENCY_CODE } from '../config';
import { formatStarsAsIcon, formatTonAsIcon } from './localization/format';

export function convertCurrencyFromBaseUnit(amount: number, currency: string) {
  return amount / 10 ** getCurrencyExp(currency);
}

export function convertCurrencyToBaseUnit(amount: number, currency: string) {
  return amount * 10 ** getCurrencyExp(currency);
}

export function convertTonFromNanos(nanos: number): number {
  return convertCurrencyFromBaseUnit(nanos, TON_CURRENCY_CODE);
}

export function convertTonToNanos(ton: number): number {
  return convertCurrencyToBaseUnit(ton, TON_CURRENCY_CODE);
}

export function formatCurrency(
  lang: LangFn,
  totalPrice: number,
  currency: string,
  options?: {
    shouldOmitFractions?: boolean;
    iconClassName?: string;
    asFontIcon?: boolean;
  },
): TeactNode {
  const price = convertCurrencyFromBaseUnit(totalPrice, currency);

  if (currency === STARS_CURRENCY_CODE) {
    return formatStarsAsIcon(lang, price, { asFont: options?.asFontIcon, className: options?.iconClassName });
  }

  if (currency === TON_CURRENCY_CODE) {
    return formatTonAsIcon(lang, price, { asFont: options?.asFontIcon, className: options?.iconClassName });
  }

  return formatCurrencyAsString(totalPrice, currency, lang.code, options);
}

export function convertTonToUsd(amount: number, usdRate: number): number {
  const tonInRegularUnits = convertTonFromNanos(amount);
  return tonInRegularUnits * usdRate * 100;
}

export function formatCurrencyAsString(
  totalPrice: number,
  currency: string,
  locale: string = 'en',
  options?: {
    shouldOmitFractions?: boolean;
  },
) {
  const price = convertCurrencyFromBaseUnit(totalPrice, currency);

  if ((options?.shouldOmitFractions || currency === STARS_CURRENCY_CODE) && Number.isInteger(price)) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  }

  if (currency === TON_CURRENCY_CODE) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 10,
    }).format(price);
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(price);
}

function getCurrencyExp(currency: string) {
  if (currency === TON_CURRENCY_CODE) {
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
