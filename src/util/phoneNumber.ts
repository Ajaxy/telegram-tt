import type { ApiCountryCode } from '../api/types';

const PATTERN_PLACEHOLDER = 'X';
const DEFAULT_PATTERN = 'XXX XXX XXX XXX';

export function getCountryCodesByIso(phoneCodeList: ApiCountryCode[], iso: string) {
  return phoneCodeList.filter((country) => country.iso2 === iso);
}

export function getCountryFromPhoneNumber(phoneCodeList: ApiCountryCode[], input = '') {
  let phoneNumber = input.replace(/[^\d+]+/g, '');
  if (phoneNumber.startsWith('+')) {
    phoneNumber = phoneNumber.substr(1);
  }

  const possibleCountries = phoneCodeList
    .filter((country) => phoneNumber.startsWith(country.countryCode));
  const codesWithPrefix: { code: string; country: ApiCountryCode }[] = possibleCountries
    .map((country) => (country.prefixes || ['']).map((prefix) => {
      return {
        code: `${country.countryCode}${prefix}`,
        country,
      };
    }))
    .flat();

  const bestMatches = codesWithPrefix
    .filter(({ code }) => phoneNumber.startsWith(code))
    .sort((a, b) => a.code.length - b.code.length);

  return bestMatches[bestMatches.length - 1]?.country;
}

export function formatPhoneNumber(input: string, country?: ApiCountryCode) {
  if (!input) {
    return '';
  }

  let phoneNumber = input.replace(/[^\d]+/g, '');
  if (country) {
    phoneNumber = phoneNumber.substr(country.countryCode.length);
  } else if (input.startsWith('+')) {
    return input;
  }
  const pattern = getBestPattern(phoneNumber, country?.patterns);

  const result: string[] = []; // Result character array
  let j = 0; // Position inside pattern
  for (let i = 0; i < phoneNumber.length; i++) {
    while (pattern[j] !== PATTERN_PLACEHOLDER && j < pattern.length) {
      result.push(pattern[j]);
      if (pattern[j] === phoneNumber[i]) { // If pattern contains digits, move input position too
        i++;
        if (i === phoneNumber.length) break; // But don't overdo it, or it will insert full pattern unexpectedly
      }
      j++;
    }

    result.push(phoneNumber[i]); // For placeholder characters, setting current input digit
    j++;
  }

  return result.join('');
}

function getBestPattern(numberWithoutCode: string, patterns?: string[]) {
  if (!patterns || patterns.length === 0) return DEFAULT_PATTERN;
  if (patterns.length === 1) return patterns[0];

  const defaultPattern = patterns.find((pattern) => pattern.startsWith(PATTERN_PLACEHOLDER)) || DEFAULT_PATTERN;

  const bestMatches = patterns.filter((pattern) => {
    const stripped = pattern.replace(/[^\dX]+/g, '');
    if (stripped.startsWith(PATTERN_PLACEHOLDER)) return false; // Don't consider default number format here
    for (let i = 0; i < numberWithoutCode.length; i++) {
      if (i > stripped.length - 1 || (stripped[i] !== PATTERN_PLACEHOLDER && stripped[i] !== numberWithoutCode[i])) {
        return false;
      }
    }
    return true;
  });

  // Playing it safe: if not sure, use default for that region
  return bestMatches.length === 1 ? bestMatches[0] : defaultPattern;
}

export function formatPhoneNumberWithCode(phoneCodeList: ApiCountryCode[], phoneNumber: string) {
  if (!phoneNumber) {
    return '';
  }

  const numberWithPlus = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
  const country = getCountryFromPhoneNumber(phoneCodeList, numberWithPlus);
  if (!country) {
    return numberWithPlus;
  }
  return `+${country.countryCode} ${formatPhoneNumber(numberWithPlus, country)}`;
}
