import { type TeactNode } from '../lib/teact/teact';

import type { LangFn } from './localization';

import { STARS_CURRENCY_CODE, TON_CURRENCY_CODE } from '../config';
import { formatStarsAsIcon } from './localization/format';
import { getBigIntAbs } from './numbers';

const FALLBACK_LANG_CODE = 'en';
const ZERO_COLLAPSE_MIN_COUNT = 6;
const COLLAPSIBLE_ZEROS_REGEX = new RegExp(`^0\\.(0{${ZERO_COLLAPSE_MIN_COUNT},})(?=\\d)`);
const TRAILING_ZEROS_REGEX = /0+$/;
const LEADING_NUMBER_REGEX = /^\+?(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?/i;
// A pasted `1e999999` must not build a huge number, and 1e30 TON is already past `MAX_COINS`
const MAX_EXPONENT = 30;
const SUBSCRIPT_DIGITS = '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089';
const SHORT_FRACTION_DIGITS = 2;

export function convertCurrencyFromBaseUnit(amount: number, currency: string) {
  return amount / 10 ** getCurrencyExp(currency);
}

function convertCurrencyToBaseUnit(amount: number, currency: string) {
  return amount * 10 ** getCurrencyExp(currency);
}

// The only way from nanotons to a float, which is only fit for display, plurals and fiat
export function convertTonFromNanos(nanos: bigint): number {
  return convertCurrencyFromBaseUnit(Number(nanos), TON_CURRENCY_CODE);
}

// The decimal point is shifted in the digit string. Parsing through a float would lose nanotons on large amounts.
export function parseTonToNanos(value: string): bigint {
  const exp = getCurrencyExp(TON_CURRENCY_CODE);
  const [whole = '', fraction = '', ...rest] = value.split('.');
  const digits = `${whole}${fraction.slice(0, exp).padEnd(exp, '0')}`;

  return !rest.length && /^\d+$/.test(digits) ? BigInt(digits) : 0n;
}

// Takes the number at the start and ignores the rest, as `parseFloat` does, e.g. `1.2.3` gives 1.2 and `1e3` gives 1000
export function parseTonPrefixToNanos(value: string): bigint {
  const [, whole, fraction = '', exponent = '0'] = value.trimStart().match(LEADING_NUMBER_REGEX)!;
  const shift = Math.min(Math.max(Number(exponent), -MAX_EXPONENT), MAX_EXPONENT);
  const scale = getCurrencyExp(TON_CURRENCY_CODE) - fraction.length + shift;
  const mantissa = BigInt(`0${whole}${fraction}`);

  return scale >= 0 ? mantissa * 10n ** BigInt(scale) : mantissa / 10n ** BigInt(-scale);
}

// Integer math avoids the exponent form `String` gives numbers below 1e-7
export function formatTonFromNanos(nanos: bigint, shouldCollapseZeros?: boolean): string {
  const exp = getCurrencyExp(TON_CURRENCY_CODE);
  const unit = BigInt(10 ** exp);
  const abs = getBigIntAbs(nanos);
  const whole = abs / unit;
  const fraction = String(abs % unit).padStart(exp, '0').replace(TRAILING_ZEROS_REGEX, '');
  const plain = fraction ? `${whole}.${fraction}` : String(whole);

  return shouldCollapseZeros ? collapseFractionZeros(plain) : plain;
}

// Two decimals for whole grams and two significant digits below one, e.g. `12.34` and `0.0012`
export function formatTonShortFromNanos(nanos: bigint): string {
  const exp = getCurrencyExp(TON_CURRENCY_CODE);
  const abs = getBigIntAbs(nanos);
  const leadingZeros = abs < 10 ** exp ? exp - String(abs).length : 0;
  const unit = 10n ** BigInt(Math.max(exp - leadingZeros - SHORT_FRACTION_DIGITS, 0));

  return formatTonFromNanos((abs / unit) * unit, true);
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

  return formatCurrencyAsString(totalPrice, currency, lang.code, options);
}

export function convertTonToUsd(nanos: bigint, usdRate: number): number {
  return convertTonFromNanos(nanos) * usdRate * 100;
}

// Through USD, as `payments.getCurrencyRates` does
function convertTonToCurrency(nanos: bigint, tonUsdRate: number, currency: string, currencyRate: number): number {
  return convertCurrencyToBaseUnit(convertTonFromNanos(nanos) * tonUsdRate * currencyRate, currency);
}

export function formatTonInFiat(
  nanos: bigint,
  tonUsdRate: number | undefined,
  currency: string,
  currencyRate: number | undefined,
  locale?: string,
  options?: {
    shouldOmitFractions?: boolean;
  },
): string | undefined {
  if (tonUsdRate === undefined || currencyRate === undefined) {
    return undefined;
  }

  return formatCurrencyAsString(
    convertTonToCurrency(nanos, tonUsdRate, currency, currencyRate),
    currency,
    locale,
    { shouldOmitFractions: options?.shouldOmitFractions },
  );
}

export function formatTonAsCurrency(nanos: bigint, locale: string = FALLBACK_LANG_CODE) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: TON_CURRENCY_CODE,
    minimumFractionDigits: 0,
    maximumFractionDigits: 10,
  }).format(convertTonFromNanos(nanos));
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
