import countryList from './countries';

export function getCountryById(id: string) {
  return countryList.find((c) => c.id === id) as Country;
}

// Empty groups are used to preserve 5 callback arguments for `replace` method
function getPhoneNumberFormat(country?: Country) {
  const id = country ? country.id : 'UNKNOWN';

  switch (id) {
    case 'RU':
    case 'US':
      return /(\d{1,3})(\d{1,3})?(\d{1,2})?(\d{1,2})?()?/;
    case 'GB':
      return /(\d{1,4})(\d{1,5})?()?()?()?/;
    case 'UA':
    case 'FI':
    case 'AE':
      return /(\d{1,2})(\d{1,3})?(\d{1,2})?(\d{1,2})?()?/;
    default:
      return /(\d{1,3})(\d{1,3})?(\d{1,3})?(\d{1,3})?(\d{1,3})?/;
  }
}

export function getCountryFromPhoneNumber(input: string) {
  let phoneNumber = input.replace(/[^\d+]+/g, '');
  if (!phoneNumber.startsWith('+')) {
    phoneNumber = `+${phoneNumber}`;
  }

  const possibleCountries = countryList
    .filter((country: Country) => phoneNumber.startsWith(country.code))
    .sort((a, b) => a.code.length - b.code.length);

  return possibleCountries[possibleCountries.length - 1];
}

export function formatPhoneNumber(input: string, country?: Country) {
  let phoneNumber = input.replace(/[^\d]+/g, '');
  if (country) {
    phoneNumber = phoneNumber.substr(country.code.length - 1);
  } else if (input.startsWith('+')) {
    return input;
  }

  phoneNumber = phoneNumber.replace(getPhoneNumberFormat(country), (_, p1, p2, p3, p4, p5) => {
    const separator = country && country.id === 'GB' ? ' ' : '-';

    let output = '';
    if (p1) output = `${p1}`;
    if (p2) output += ` ${p2}`;
    if (p3) output += `${separator}${p3}`;
    if (p4) output += `${separator}${p4}`;
    if (p5) output += `${separator}${p5}`;
    return output;
  });

  return phoneNumber;
}

export function formatPhoneNumberWithCode(phoneNumber: string) {
  const numberWithPlus = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
  const country = getCountryFromPhoneNumber(numberWithPlus);
  if (!country) {
    return numberWithPlus;
  }
  return `${country.code} ${formatPhoneNumber(numberWithPlus, country)}`;
}

export { countryList };
