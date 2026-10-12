const DECIMAL_COMMA_REGEX = /,/g;
const INVALID_AMOUNT_CHARS_REGEX = /[^0-9.]/g;

// A decimal comma counts as a decimal point; digits past `maxDecimals` are dropped as typed
export function normalizeAmountInput(value: string, maxDecimals?: number): string {
  const normalized = value.replace(DECIMAL_COMMA_REGEX, '.').replace(INVALID_AMOUNT_CHARS_REGEX, '');
  if (maxDecimals === undefined) return normalized;

  const [whole, ...fraction] = normalized.split('.');

  return fraction.length ? `${whole}.${fraction.join('').slice(0, maxDecimals)}` : whole;
}
