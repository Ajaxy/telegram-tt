import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiConfig,
  ApiCountry, ApiSession, ApiUrlAuthResult, ApiWallpaper, ApiWebSession,
} from '../../types';
import type { ApiPrivacySettings, ApiPrivacyKey, PrivacyVisibility } from '../../../types';

import { buildApiDocument, buildApiReaction } from './messages';
import { buildApiPeerId, getApiChatIdFromMtpPeer } from './peers';
import { pick } from '../../../util/iteratees';
import { getServerTime } from '../../../util/serverTime';
import { buildApiUser } from './users';
import { addUserToLocalDb } from '../helpers';

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

export function buildPrivacyRules(rules: GramJs.TypePrivacyRule[]): ApiPrivacySettings {
  let visibility: PrivacyVisibility | undefined;
  let allowUserIds: string[] | undefined;
  let allowChatIds: string[] | undefined;
  let blockUserIds: string[] | undefined;
  let blockChatIds: string[] | undefined;

  rules.forEach((rule) => {
    if (rule instanceof GramJs.PrivacyValueAllowAll) {
      visibility = visibility || 'everybody';
    } else if (rule instanceof GramJs.PrivacyValueAllowContacts) {
      visibility = visibility || 'contacts';
    } else if (rule instanceof GramJs.PrivacyValueDisallowContacts) {
      visibility = visibility || 'nonContacts';
    } else if (rule instanceof GramJs.PrivacyValueDisallowAll) {
      visibility = visibility || 'nobody';
    } else if (rule instanceof GramJs.PrivacyValueAllowUsers) {
      allowUserIds = rule.users.map((chatId) => buildApiPeerId(chatId, 'user'));
    } else if (rule instanceof GramJs.PrivacyValueDisallowUsers) {
      blockUserIds = rule.users.map((chatId) => buildApiPeerId(chatId, 'user'));
    } else if (rule instanceof GramJs.PrivacyValueAllowChatParticipants) {
      allowChatIds = rule.chats.map((chatId) => buildApiPeerId(chatId, 'chat'));
    } else if (rule instanceof GramJs.PrivacyValueDisallowChatParticipants) {
      blockChatIds = rule.chats.map((chatId) => buildApiPeerId(chatId, 'chat'));
    }
  });

  if (!visibility) {
    // disallow by default.
    visibility = 'nobody';
  }

  return {
    visibility,
    allowUserIds: allowUserIds || [],
    allowChatIds: allowChatIds || [],
    blockUserIds: blockUserIds || [],
    blockChatIds: blockChatIds || [],
  };
}

export function buildApiNotifyException(
  notifySettings: GramJs.TypePeerNotifySettings, peer: GramJs.TypePeer, serverTimeOffset: number,
) {
  const {
    silent, muteUntil, showPreviews, otherSound,
  } = notifySettings;

  const hasSound = Boolean(otherSound && !(otherSound instanceof GramJs.NotificationSoundNone));

  return {
    chatId: getApiChatIdFromMtpPeer(peer),
    isMuted: silent || (typeof muteUntil === 'number' && getServerTime(serverTimeOffset) < muteUntil),
    ...(!hasSound && { isSilent: true }),
    ...(showPreviews !== undefined && { shouldShowPreviews: Boolean(showPreviews) }),
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
  };
}
