import { convertTonFromNanos, formatTonFromNanos } from '../../../../util/formatCurrency';

export type AmountToken = {
  char: string;
  isFraction?: boolean;
  key?: string;
};

export const TON_DECIMALS = 9;
export const DIGIT_REGEX = /^\d$/;
export const POINT_KEYS = new Set(['.', ',']);
const SPACE_REGEX = /^\s$/;

const DECIMAL_COMMA_REGEX = /,/g;
const INVALID_AMOUNT_CHARS_REGEX = /[^0-9.]/g;
const NON_AMOUNT_CHARS_REGEX = /[^0-9.,]/g;
// One mark between a group of one to three digits and three more digits, as in `1,000`
const AMBIGUOUS_AMOUNT_REGEX = /^[1-9]\d{0,2}[.,]\d{3}$/;
// Some languages group only from five digits, so a million shows the separator in all of them
const GROUPED_NUMBER = 1000000;
const MAX_INTEGER_DIGITS = 9;
const SHORT_FRACTION_DIGITS = 2;
const TRAILING_FRACTION_ZEROS_REGEX = /\.?0+$/;

// A decimal comma counts as a decimal point; digits past `maxDecimals` are dropped as typed
export function normalizeAmountInput(value: string, maxDecimals?: number): string {
  const normalized = value.replace(DECIMAL_COMMA_REGEX, '.').replace(INVALID_AMOUNT_CHARS_REGEX, '');
  if (maxDecimals === undefined) return normalized;

  const [whole, ...fraction] = normalized.split('.');

  return fraction.length ? `${whole}.${fraction.join('').slice(0, maxDecimals)}` : whole;
}

// The typing steps keep the amount as a string, so `10.` stays until the next digit. Each step returns `undefined`
// when it refuses the key.
export function appendAmountDigit(amount: string, digit: string, maxDecimals: number): string | undefined {
  const [integer, fraction] = amount.split('.');

  if (fraction !== undefined) return fraction.length < maxDecimals ? amount + digit : undefined;

  // A leading zero is not typed: `0` keeps the field empty, and another digit replaces the zero shown in it
  if (!integer || integer === '0') return digit === '0' ? '' : digit;

  return integer.length < MAX_INTEGER_DIGITS ? amount + digit : undefined;
}

export function appendAmountPoint(amount: string, maxDecimals: number): string | undefined {
  return maxDecimals <= 0 || amount.includes('.') ? undefined : `${amount || '0'}.`;
}

// Returns `undefined` when any character is refused: if a pasted amount were cut or cleaned up, it would become a
// different sum. Spaces between digits are allowed. Any other character, such as a minus sign or the `e` of an
// exponent, is refused. `onChange` gets each character that changes the amount.
export function typeAmountText(
  amount: string, text: string, maxDecimals: number, onChange?: (char: string) => void,
): string | undefined {
  let next = amount;

  for (const char of text) {
    const step = DIGIT_REGEX.test(char) ? appendAmountDigit(next, char, maxDecimals)
      : POINT_KEYS.has(char) ? appendAmountPoint(next, maxDecimals)
        : SPACE_REGEX.test(char) ? next : undefined;
    if (step === undefined) return undefined;

    if (step !== next) onChange?.(char);
    next = step;
  }

  return next;
}

// With both marks the last one is the decimal point, and a mark that repeats only separates groups. A single mark, as
// in `1,000`, separates groups only when it is `groupSeparator` and three digits follow it; otherwise it is the decimal
// point, since an amount read a thousand times smaller is the safer mistake.
export function stripAmountGroupSeparators(text: string, groupSeparator?: string) {
  const commaCount = text.split(',').length - 1;
  const pointCount = text.split('.').length - 1;

  if (commaCount && pointCount) {
    return text.replaceAll(text.lastIndexOf(',') > text.lastIndexOf('.') ? '.' : ',', '');
  }

  if (commaCount > 1) return text.replaceAll(',', '');
  if (pointCount > 1) return text.replaceAll('.', '');

  if (groupSeparator && text.includes(groupSeparator)
    && AMBIGUOUS_AMOUNT_REGEX.test(text.replace(NON_AMOUNT_CHARS_REGEX, ''))) {
    return text.replace(groupSeparator, '');
  }

  return text;
}

// The separator all `locales` group digits with, or `undefined` when they differ
export function getAmountGroupSeparator(locales: string[]) {
  const separators = locales.map((locale) => (
    new Intl.NumberFormat(locale).formatToParts(GROUPED_NUMBER).find(({ type }) => type === 'group')?.value
  ));

  return separators.every((separator) => separator === separators[0]) ? separators[0] : undefined;
}

export function eraseAmountChar(amount: string): string | undefined {
  if (!amount || amount === '0') return undefined;

  const erased = amount.slice(0, -1);

  return erased === '0' ? '' : erased;
}

// Commas are known by the group they close and fraction digits by their place, so they keep their cells as the number
// grows. Integer digits have no key and pair by content in `matchAmountTokens`.
export function buildAmountTokens(integer: string, fraction: string): AmountToken[] {
  const commaCount = integer.split(',').length - 1;
  let commaIndex = 0;
  const tokens: AmountToken[] = Array.from(integer, (char) => (
    char === ',' ? { char, key: `comma${commaCount - commaIndex++}` } : { char }
  ));
  Array.from(fraction, (char, i) => tokens.push({ char, isFraction: true, key: `fraction${i}` }));

  return tokens;
}

// Gives each new token the index of the old one whose cell it takes, or `undefined` for a new cell. Integer digits that
// stay the same at the start and at the end keep their cells, and the rest pair in order, so a digit typed at the end
// appears at the end.
export function matchAmountTokens(oldTokens: AmountToken[], newTokens: AmountToken[]): (number | undefined)[] {
  const oldDigits = getIntegerDigitIndices(oldTokens);
  const newDigits = getIntegerDigitIndices(newTokens);
  const matches = new Array<number | undefined>(newTokens.length).fill(undefined);

  let head = 0;
  while (head < oldDigits.length && head < newDigits.length
    && oldTokens[oldDigits[head]].char === newTokens[newDigits[head]].char) {
    head++;
  }

  let tail = 0;
  while (tail < oldDigits.length - head && tail < newDigits.length - head
    && oldTokens[oldDigits.at(-1 - tail)!].char === newTokens[newDigits.at(-1 - tail)!].char) {
    tail++;
  }

  newDigits.forEach((newIndex, i) => {
    const fromEnd = newDigits.length - 1 - i;
    if (fromEnd < tail) {
      matches[newIndex] = oldDigits[oldDigits.length - 1 - fromEnd];
    } else if (i < oldDigits.length - tail) {
      matches[newIndex] = oldDigits[i];
    }
  });

  const oldIndexByKey = new Map<string, number>();
  oldTokens.forEach(({ key }, i) => {
    if (key) oldIndexByKey.set(key, i);
  });
  newTokens.forEach(({ key }, i) => {
    if (key) matches[i] = oldIndexByKey.get(key);
  });

  return matches;
}

function getIntegerDigitIndices(tokens: AmountToken[]) {
  return tokens.flatMap(({ key }, i) => (key ? [] : [i]));
}

// A gram amount converted from fiat is rounded: to two decimals from one gram, and to two significant digits below it
export function roundTonEntry(nanos: bigint): string {
  if (nanos <= 0n) return '';

  const leadingZeros = Math.max(TON_DECIMALS - String(nanos).length, 0);
  const unit = 10n ** BigInt(Math.max(TON_DECIMALS - leadingZeros - SHORT_FRACTION_DIGITS, 0));

  return formatTonFromNanos(((nanos + unit / 2n) / unit) * unit);
}

// The rate is the price of one gram in the fiat currency
export function convertFiatEntryToTon(entry: string, rate: number): string {
  const value = Number(entry);
  if (!value) return '';

  return roundTonEntry(BigInt(Math.round((value / rate) * 10 ** TON_DECIMALS)));
}

export function convertTonToFiatEntry(nanos: bigint, rate: number, decimals: number): string {
  const fixed = (convertTonFromNanos(nanos) * rate).toFixed(decimals);
  const trimmed = fixed.includes('.') ? fixed.replace(TRAILING_FRACTION_ZEROS_REGEX, '') : fixed;

  return trimmed === '0' ? '' : trimmed;
}

// A narrow symbol is a glyph for most currencies, while the plain one is often the code: RUB rather than ₽. A currency
// without a symbol of its own gets none, as its code follows the amount anyway.
export function getCurrencySymbol(currency: string, locale: string) {
  const symbol = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
    .formatToParts(0)
    .find(({ type }) => type === 'currency')?.value;

  return symbol !== currency ? symbol : undefined;
}
