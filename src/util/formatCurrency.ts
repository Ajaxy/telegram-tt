import type { LangCode } from '../types';

export function formatCurrency(totalPrice: number, currency?: string, locale: LangCode = 'en') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(currency === 'JPY' ? totalPrice : totalPrice / 100);
}
