import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiChatLink,
  ApiCollectibleInfo,
  ApiConfig,
  ApiCountry,
  ApiLanguage,
  ApiOldLangString,
  ApiPrivacyKey,
  ApiRestrictionReason,
  ApiSession,
  ApiTimezone,
  ApiUrlAuthResult,
  ApiWallpaper,
  ApiWebSession,
  LangPackStringValue,
} from '../../types';

import {
  omit, omitUndefined, pick,
} from '../../../util/iteratees';
import { toJSNumber } from '../../../util/numbers';
import { addUserToLocalDb } from '../helpers/localDb';
import { omitVirtualClassFields } from './helpers';
import { buildApiDocument, buildMessageTextContent } from './messageContent';
import { buildApiPeerId, getApiChatIdFromMtpPeer } from './peers';
import { buildApiReaction } from './reactions';
import { buildApiUser } from './users';

export function buildApiWallpaper(wallpaper: GramJs.TypeWallPaper): ApiWallpaper | undefined {
  if (wallpaper instanceof GramJs.WallPaperNoFile) {
    // TODO: Plain color wallpapers
    return undefined;
  }

  const { slug } = wallpaper;

  const document = buildApiDocument(wallpaper.document);

  if (!document) {
    return undefined;
  }

  return {
    slug,
    document,
  };
}

export function buildApiSession(session: GramJs.Authorization): ApiSession {
  return {
    isCurrent: Boolean(session.current),
    isOfficialApp: Boolean(session.officialApp),
    isPasswordPending: Boolean(session.passwordPending),
    hash: String(session.hash),
    areCallsEnabled: !session.callRequestsDisabled,
    areSecretChatsEnabled: !session.encryptedRequestsDisabled,
    isUnconfirmed: session.unconfirmed,
    ...pick(session, [
      'deviceModel', 'platform', 'systemVersion', 'appName', 'appVersion', 'dateCreated', 'dateActive',
      'ip', 'country', 'region',
    ]),
  };
}

export function buildApiWebSession(session: GramJs.WebAuthorization): ApiWebSession {
  return {
    hash: String(session.hash),
    botId: buildApiPeerId(session.botId, 'user'),
    ...pick(session, [
      'platform', 'browser', 'dateCreated', 'dateActive', 'ip', 'region', 'domain',
    ]),
  };
}

export function buildPrivacyKey(key: GramJs.TypePrivacyKey): ApiPrivacyKey | undefined {
  switch (key.className) {
    case 'PrivacyKeyPhoneNumber':
      return 'phoneNumber';
    case 'PrivacyKeyAddedByPhone':
      return 'addByPhone';
    case 'PrivacyKeyStatusTimestamp':
      return 'lastSeen';
    case 'PrivacyKeyProfilePhoto':
      return 'profilePhoto';
    case 'PrivacyKeyPhoneCall':
      return 'phoneCall';
    case 'PrivacyKeyPhoneP2P':
      return 'phoneP2P';
    case 'PrivacyKeyForwards':
      return 'forwards';
    case 'PrivacyKeyVoiceMessages':
      return 'voiceMessages';
    case 'PrivacyKeyChatInvite':
      return 'chatInvite';
    case 'PrivacyKeyAbout':
      return 'bio';
    case 'PrivacyKeyBirthday':
      return 'birthday';
    case 'PrivacyKeyStarGiftsAutoSave':
      return 'gifts';
    case 'PrivacyKeyNoPaidMessages':
      return 'noPaidMessages';
  }

  return undefined;
}

function buildApiCountry(country: GramJs.help.Country, code: GramJs.help.CountryCode) {
  const {
    hidden, iso2, defaultName, name,
  } = country;
  const { countryCode, prefixes, patterns } = code || {};

  return {
    isHidden: hidden,
    iso2,
    defaultName,
    name,
    countryCode,
    prefixes,
    patterns,
  };
}

export function buildApiCountryList(countries: GramJs.help.Country[]) {
  const nonHiddenCountries = countries.filter(({ hidden }) => !hidden);
  const listByCode = nonHiddenCountries
    .map((country) => (
      country.countryCodes.map((code) => buildApiCountry(country, code))
    ))
    .flat()
    .sort((a: ApiCountry, b: ApiCountry) => (
      a.name ? a.name.localeCompare(b.name!) : a.defaultName.localeCompare(b.defaultName)
    ));

  const generalList = nonHiddenCountries
    .map((country) => buildApiCountry(country, country.countryCodes[0]))
    .sort((a, b) => (
      a.name ? a.name.localeCompare(b.name!) : a.defaultName.localeCompare(b.defaultName)
    ));

  return {
    phoneCodes: listByCode,
    general: generalList,
  };
}

export function buildJson(json: GramJs.TypeJSONValue): any {
  if (json instanceof GramJs.JsonNull) return undefined;
  if (json instanceof GramJs.JsonString
    || json instanceof GramJs.JsonBool
    || json instanceof GramJs.JsonNumber) return json.value;
  if (json instanceof GramJs.JsonArray) return json.value.map(buildJson);

  return json.value.reduce((acc: Record<string, any>, el) => {
    acc[el.key] = buildJson(el.value);
    return acc;
  }, {});
}

export function buildApiUrlAuthResult(result: GramJs.TypeUrlAuthResult): ApiUrlAuthResult | undefined {
  if (result instanceof GramJs.UrlAuthResultRequest) {
    const { bot, domain, requestWriteAccess } = result;
    const user = buildApiUser(bot);
    if (!user) return undefined;

    addUserToLocalDb(bot);

    return {
      type: 'request',
      domain,
      shouldRequestWriteAccess: requestWriteAccess,
      bot: user,
    };
  }

  if (result instanceof GramJs.UrlAuthResultAccepted) {
    return {
      type: 'accepted',
      url: result.url,
    };
  }

  if (result instanceof GramJs.UrlAuthResultDefault) {
    return {
      type: 'default',
    };
  }
  return undefined;
}

export function buildApiConfig(config: GramJs.Config): ApiConfig {
  const {
    testMode, expires, gifSearchUsername, chatSizeMax, autologinToken, reactionsDefault,
    messageLengthMax, editTimeLimit, forwardedCountMax,
  } = config;
  const defaultReaction = reactionsDefault && buildApiReaction(reactionsDefault);
  return {
    isTestServer: testMode,
    expiresAt: expires,
    gifSearchUsername,
    defaultReaction,
    maxGroupSize: chatSizeMax,
    autologinToken,
    maxMessageLength: messageLengthMax,
    editTimeLimit,
    maxForwardedCount: forwardedCountMax,
  };
}

export function oldBuildLangPack(mtpLangPack: GramJs.LangPackDifference) {
  return mtpLangPack.strings.reduce<Record<string, ApiOldLangString | undefined>>((acc, mtpString) => {
    acc[mtpString.key] = oldBuildLangPackString(mtpString);
    return acc;
  }, {});
}

export function oldBuildLangPackString(mtpString: GramJs.TypeLangPackString) {
  return mtpString instanceof GramJs.LangPackString
    ? mtpString.value
    : mtpString instanceof GramJs.LangPackStringPluralized
      ? omit(omitVirtualClassFields(mtpString), ['key'])
      : undefined;
}

export function buildLangStrings(strings: GramJs.TypeLangPackString[]) {
  const keysToRemove: string[] = [];
  const apiStrings = strings.reduce<Record<string, LangPackStringValue>>((acc, mtpString) => {
    if (mtpString instanceof GramJs.LangPackStringDeleted) {
      keysToRemove.push(mtpString.key);
    }

    if (mtpString instanceof GramJs.LangPackString) {
      acc[mtpString.key] = mtpString.value;
    }

    if (mtpString instanceof GramJs.LangPackStringPluralized) {
      acc[mtpString.key] = omitUndefined({
        zero: mtpString.zeroValue,
        one: mtpString.oneValue,
        two: mtpString.twoValue,
        few: mtpString.fewValue,
        many: mtpString.manyValue,
        other: mtpString.otherValue,
      });
    }

    return acc;
  }, {});

  return {
    keysToRemove,
    strings: apiStrings,
  };
}

export function buildApiLanguage(lang: GramJs.TypeLangPackLanguage): ApiLanguage {
  const {
    name, nativeName, langCode, pluralCode, rtl, stringsCount, translatedCount, translationsUrl, beta, official,
  } = lang;
  return {
    name,
    nativeName,
    langCode,
    pluralCode,
    isRtl: rtl,
    isBeta: beta,
    isOfficial: official,
    stringsCount,
    translatedCount,
    translationsUrl,
  };
}

export function buildApiTimezone(timezone: GramJs.TypeTimezone): ApiTimezone {
  const { id, name, utcOffset } = timezone;
  return {
    id,
    name,
    utcOffset,
  };
}

export function buildApiChatLink(data: GramJs.account.ResolvedBusinessChatLinks): ApiChatLink {
  const chatId = getApiChatIdFromMtpPeer(data.peer);
  return {
    chatId,
    text: buildMessageTextContent(data.message, data.entities),
  };
}

export function buildApiCollectibleInfo(info: GramJs.fragment.TypeCollectibleInfo): ApiCollectibleInfo {
  const {
    amount,
    currency,
    cryptoAmount,
    cryptoCurrency,
    purchaseDate,
    url,
  } = info;

  return {
    amount: toJSNumber(amount),
    currency,
    cryptoAmount: toJSNumber(cryptoAmount),
    cryptoCurrency,
    purchaseDate,
    url,
  };
}

export function buildApiRestrictionReasons(
  restrictionReasons?: GramJs.RestrictionReason[],
): ApiRestrictionReason[] | undefined {
  if (!restrictionReasons) {
    return undefined;
  }

  return restrictionReasons.map((
    { reason, text, platform }) =>
    ({ reason, text, platform }));
}
