import type { LangCode } from '../types';

export function formatCurrency(
  totalPrice: number,
  currency: string,
  locale: LangCode = 'en',
  shouldOmitFractions = false,
) {
  const price = totalPrice / 10 ** getCurrencyExp(currency);

  if (shouldOmitFractions && price % 1 === 0) {
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
