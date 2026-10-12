import { type TeactNode } from '../lib/teact/teact';

import type { LangFn } from './localization';

import { STARS_CURRENCY_CODE, TON_CURRENCY_CODE } from '../config';
import { formatStarsAsIcon, formatTonAsIcon } from './localization/format';

const FALLBACK_LANG_CODE = 'en';
const ZERO_COLLAPSE_MIN_COUNT = 6;
const COLLAPSIBLE_ZEROS_REGEX = new RegExp(`^0\\.(0{${ZERO_COLLAPSE_MIN_COUNT},})(?=\\d)`);
const TRAILING_ZEROS_REGEX = /0+$/;
const SUBSCRIPT_DIGITS = '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089';
const SHORT_FRACTION_DIGITS = 2;

export function convertCurrencyFromBaseUnit(amount: number, currency: string) {
  return amount / 10 ** getCurrencyExp(currency);
}

function convertCurrencyToBaseUnit(amount: number, currency: string) {
  return amount * 10 ** getCurrencyExp(currency);
}

export function convertTonFromNanos(nanos: number): number {
  return convertCurrencyFromBaseUnit(nanos, TON_CURRENCY_CODE);
}

export function convertTonToNanos(ton: number): number {
  return convertCurrencyToBaseUnit(ton, TON_CURRENCY_CODE);
}

// Integer math: past 2^53 `Number` rounds the decimal value itself
export function parseTonToNanos(value: string): number {
  const exp = getCurrencyExp(TON_CURRENCY_CODE);
  const [whole = '', fraction = ''] = value.split('.');
  const digits = `${whole}${fraction.slice(0, exp).padEnd(exp, '0')}`;

  return /^\d+$/.test(digits) ? Number(BigInt(digits)) : 0;
}

// Integer math avoids the exponent form `String` gives numbers below 1e-7
export function formatTonFromNanos(nanos: number | bigint, shouldCollapseZeros?: boolean): string {
  const exp = getCurrencyExp(TON_CURRENCY_CODE);
  const unit = BigInt(10 ** exp);

  // A dApp may ask for an amount above `Number.MAX_SAFE_INTEGER`
  const signed = typeof nanos === 'bigint' ? nanos : BigInt(Math.round(nanos));
  const abs = signed < 0n ? -signed : signed;
  const whole = abs / unit;
  const fraction = String(abs % unit).padStart(exp, '0').replace(TRAILING_ZEROS_REGEX, '');
  const plain = fraction ? `${whole}.${fraction}` : String(whole);

  return shouldCollapseZeros ? collapseFractionZeros(plain) : plain;
}

// Two decimals for whole grams and two significant digits below one, e.g. `12.34` and `0.0012`
export function formatTonShortFromNanos(nanos: number): string {
  const exp = getCurrencyExp(TON_CURRENCY_CODE);
  const abs = Math.abs(Math.round(nanos));
  const leadingZeros = abs < 10 ** exp ? exp - String(abs).length : 0;
  const unit = 10 ** Math.max(exp - leadingZeros - SHORT_FRACTION_DIGITS, 0);

  return formatTonFromNanos(Math.floor(abs / unit) * unit, true);
}

// Collapses leading fractional zeros into a subscript count, e.g. `0.00000056` becomes `0.0\u20866`
function collapseFractionZeros(value: string): string {
  return value.replace(COLLAPSIBLE_ZEROS_REGEX, (_, zeros: string) => `0.0${toSubscriptDigits(zeros.length)}`);
}

function toSubscriptDigits(value: number): string {
  return String(value).replace(/\d/g, (digit) => SUBSCRIPT_DIGITS[Number(digit)]);
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
    return formatTonAsIcon(lang, price, { className: options?.iconClassName, isMono: options?.asFontIcon });
  }

  return formatCurrencyAsString(totalPrice, currency, lang.code, options);
}

export function convertTonToUsd(amount: number, usdRate: number, isInNanos: boolean = false): number {
  const tonInRegularUnits = isInNanos ? convertTonFromNanos(amount) : amount;
  return tonInRegularUnits * usdRate * 100;
}

// Through USD, as `payments.getCurrencyRates` does
function convertTonToCurrency(
  amount: number,
  tonUsdRate: number,
  currency: string,
  currencyRate: number,
  isInNanos: boolean = false,
): number {
  const tonInRegularUnits = isInNanos ? convertTonFromNanos(amount) : amount;

  return convertCurrencyToBaseUnit(tonInRegularUnits * tonUsdRate * currencyRate, currency);
}

export function formatTonInFiat(
  amount: number,
  tonUsdRate: number | undefined,
  currency: string,
  currencyRate: number | undefined,
  locale?: string,
  options?: {
    isInNanos?: boolean;
    shouldOmitFractions?: boolean;
  },
): string | undefined {
  if (tonUsdRate === undefined || currencyRate === undefined) {
    return undefined;
  }

  return formatCurrencyAsString(
    convertTonToCurrency(amount, tonUsdRate, currency, currencyRate, options?.isInNanos),
    currency,
    locale,
    { shouldOmitFractions: options?.shouldOmitFractions },
  );
}

export function formatCurrencyAsString(
  totalPrice: number,
  currency: string,
  locale: string = FALLBACK_LANG_CODE,
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
