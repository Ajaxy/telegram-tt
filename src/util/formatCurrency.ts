import type { LangCode } from '../types';

export function formatCurrency(totalPrice: number, currency: string, locale: LangCode = 'en') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(totalPrice / 10 ** getCurrencyExp(currency));
}

function getCurrencyExp(currency: string) {
  if (currency === 'CLF') {
    return 4;
  }
  if (['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'].includes(currency)) {
    return 3;
  }
  if ([
    'BIF', 'BYR', 'CLP', 'CVE', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'UYI',
    'VND', 'VUV', 'XAF', 'XOF', 'XPF',
  ].includes(currency)) {
    return 0;
  }
  if (currency === 'MRO') {
    return 1;
  }
  return 2;
}
