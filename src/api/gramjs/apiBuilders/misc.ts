import { Api as GramJs } from '../../../lib/gramjs';

import type { ApiPrivacyKey } from '../../../types';
import type {
  ApiConfig, ApiCountry, ApiLangString,
  ApiPeerColors,
  ApiSession, ApiUrlAuthResult, ApiWallpaper, ApiWebSession,
} from '../../types';

import { buildCollectionByCallback, omit, pick } from '../../../util/iteratees';
import { getServerTime } from '../../../util/serverTime';
import { addUserToLocalDb } from '../helpers';
import { omitVirtualClassFields } from './helpers';
import { buildApiDocument } from './messageContent';
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
  }

  return undefined;
}

export function buildApiNotifyException(
  notifySettings: GramJs.TypePeerNotifySettings, peer: GramJs.TypePeer,
) {
  const {
    silent, muteUntil, showPreviews, otherSound,
  } = notifySettings;

  const hasSound = Boolean(otherSound && !(otherSound instanceof GramJs.NotificationSoundNone));

  return {
    chatId: getApiChatIdFromMtpPeer(peer),
    isMuted: silent || (typeof muteUntil === 'number' && getServerTime() < muteUntil),
    ...(!hasSound && { isSilent: true }),
    ...(showPreviews !== undefined && { shouldShowPreviews: Boolean(showPreviews) }),
    muteUntil,
  };
}

export function buildApiNotifyExceptionTopic(
  notifySettings: GramJs.TypePeerNotifySettings, peer: GramJs.TypePeer, topicId: number,
) {
  const {
    silent, muteUntil, showPreviews, otherSound,
  } = notifySettings;

  const hasSound = Boolean(otherSound && !(otherSound instanceof GramJs.NotificationSoundNone));

  return {
    chatId: getApiChatIdFromMtpPeer(peer),
    topicId,
    isMuted: silent || (typeof muteUntil === 'number' && getServerTime() < muteUntil),
    ...(!hasSound && { isSilent: true }),
    ...(showPreviews !== undefined && { shouldShowPreviews: Boolean(showPreviews) }),
    muteUntil,
  };
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
  const defaultReaction = config.reactionsDefault && buildApiReaction(config.reactionsDefault);
  return {
    expiresAt: config.expires,
    gifSearchUsername: config.gifSearchUsername,
    defaultReaction,
    maxGroupSize: config.chatSizeMax,
    autologinToken: config.autologinToken,
  };
}

export function buildLangPack(mtpLangPack: GramJs.LangPackDifference) {
  return mtpLangPack.strings.reduce<Record<string, ApiLangString | undefined>>((acc, mtpString) => {
    acc[mtpString.key] = buildLangPackString(mtpString);
    return acc;
  }, {});
}

export function buildLangPackString(mtpString: GramJs.TypeLangPackString) {
  return mtpString instanceof GramJs.LangPackString
    ? mtpString.value
    : mtpString instanceof GramJs.LangPackStringPluralized
      ? omit(omitVirtualClassFields(mtpString), ['key'])
      : undefined;
}

function buildApiPeerColorSet(colorSet: GramJs.help.TypePeerColorSet) {
  if (colorSet instanceof GramJs.help.PeerColorSet) {
    return colorSet.colors.map((color) => `#${color.toString(16).padStart(6, '0')}`);
  }
  return undefined;
}

export function buildApiPeerColors(wrapper: GramJs.help.TypePeerColors): ApiPeerColors['general'] | undefined {
  if (!(wrapper instanceof GramJs.help.PeerColors)) return undefined;

  return buildCollectionByCallback(wrapper.colors, (color) => {
    return [color.colorId, {
      isHidden: color.hidden,
      colors: color.colors && buildApiPeerColorSet(color.colors),
      darkColors: color.darkColors && buildApiPeerColorSet(color.darkColors),
    }];
  });
}
