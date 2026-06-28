import type { LangFn, LangFnParameters } from '../../../../util/localization';

export function canVoteInPollAsSubscriber(isRestrictedToSubscribers?: true, isChatNotJoined?: boolean) {
  return !isRestrictedToSubscribers || !isChatNotJoined;
}

export function canVoteInPollCountry(phoneCountryIso2?: string, allowedCountryCodes?: string[]) {
  if (!allowedCountryCodes?.length || !phoneCountryIso2) {
    return true;
  }

  const phoneCountryCode = phoneCountryIso2.toUpperCase();

  return allowedCountryCodes.some((countryCode) => countryCode.toUpperCase() === phoneCountryCode);
}

export function getPollSubscriberRestrictionMessage(
  channel?: string,
  isRestrictedToSubscribers?: true,
): LangFnParameters | undefined {
  return isRestrictedToSubscribers && channel
    ? {
      key: 'PollSubscriberRestriction',
      variables: { channel },
    }
    : undefined;
}

export function getPollCountryRestrictionMessage(
  lang: LangFn,
  countryCodes?: string[],
): LangFnParameters | undefined {
  const countries = getPollCountryRestrictionCountries(lang, countryCodes);

  return countries
    ? {
      key: 'PollCountryRestriction',
      variables: { countries },
      options: { withNodes: true, withMarkdown: true },
    }
    : undefined;
}

function getPollCountryRestrictionCountries(lang: LangFn, countryCodes?: string[]) {
  if (!countryCodes?.length) {
    return undefined;
  }

  const countryNames: string[] = [];

  countryCodes.forEach((countryCode) => {
    const countryName = getCountryName(lang, countryCode);

    if (countryName) {
      countryNames.push(countryName);
    }
  });

  return countryNames.length ? lang.conjunction(countryNames) : undefined;
}

function getCountryName(lang: LangFn, countryCode: string) {
  const normalizedCountryCode = countryCode.toUpperCase();

  return normalizedCountryCode ? lang.region(normalizedCountryCode) || normalizedCountryCode : undefined;
}
