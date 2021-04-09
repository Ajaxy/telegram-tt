const CURRENCIES: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  RUB: '₽',
  UAH: '₴',
  INR: '₹',
  AED: 'د.إ',
};

export function getCurrencySign(currency: string | undefined): string {
  if (!currency) {
    return '';
  }
  return CURRENCIES[currency] || '';
}
